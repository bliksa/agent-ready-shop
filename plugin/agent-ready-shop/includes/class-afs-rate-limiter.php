<?php
/**
 * Rate limiting for the agentic REST layer.
 *
 * Design principles (see implementation brief):
 *  - A 429 is an instruction ("wait N seconds"), never a bare rejection.
 *  - The money path (checkout with a mandate/session) is NEVER hard-throttled.
 *  - Per (agent_id, class) token buckets, never a single flat per-IP bucket.
 *  - Buckets live in a persistent object cache; MySQL transients are a loudly
 *    flagged degraded fallback only.
 *  - Circuit breaker applies to `discovery` only, never cart/checkout.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Rate_Limiter {

	const GROUP = 'afs_rl';

	/**
	 * Verified-tier budgets per class: [ limit/min, burst ].
	 * Starting points — tune to observed P99. Filterable via `afs_rate_limits`.
	 */
	private function limits() {
		return apply_filters( 'afs_rate_limits', array(
			'discovery' => array( 'limit' => 300, 'burst' => 400 ),
			'cart'      => array( 'limit' => 60,  'burst' => 90 ),
			'checkout'  => array( 'limit' => 600, 'burst' => 600 ),
		) );
	}

	/** Anonymous / unidentified traffic gets a fraction of the budget. */
	const ANON_FACTOR = 0.2;

	/** Circuit breaker (discovery only). */
	const CB_THRESHOLD = 5;   // consecutive 429s before tripping.
	const CB_BASE      = 60;  // base open seconds (exponential reopen).

	/** Stashed headers for the successful-response filter. */
	private $applied = null;

	/**
	 * Register hooks.
	 */
	public function hooks() {
		if ( ! AFS_Settings::get( 'enable_rate_limit' ) ) {
			return;
		}
		add_filter( 'rest_pre_dispatch', array( $this, 'maybe_limit' ), 10, 3 );
		add_filter( 'rest_post_dispatch', array( $this, 'attach_headers' ), 10, 3 );
		add_action( 'admin_notices', array( $this, 'degraded_notice' ) );
	}

	/**
	 * Advertised limits for the manifest (verified tier).
	 *
	 * @return array
	 */
	public function advertised_limits() {
		$out = array();
		foreach ( $this->limits() as $class => $b ) {
			$out[ $class ] = array(
				'limit_per_min'  => $b['limit'],
				'burst'          => $b['burst'],
				'anonymous_pct'  => (int) ( self::ANON_FACTOR * 100 ),
				'money_path_exempt' => ( 'checkout' === $class ),
			);
		}
		return $out;
	}

	/**
	 * Middleware: enforce the bucket for our namespace before dispatch.
	 *
	 * @param mixed           $result  Short-circuit result (null = continue).
	 * @param WP_REST_Server  $server  Server.
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public function maybe_limit( $result, $server, $request ) {
		if ( null !== $result ) {
			return $result; // Something already handled it.
		}
		$route = $request->get_route();
		if ( 0 !== strpos( ltrim( $route, '/' ), AFS_REST_NAMESPACE . '/' ) ) {
			return $result; // Not our namespace.
		}
		// Never limit an authenticated site admin testing the API.
		if ( current_user_can( 'manage_options' ) ) {
			return $result;
		}

		$class = $this->classify( $route );

		// Golden rule: money-path requests with a mandate/session are exempt.
		if ( 'checkout' === $class && $this->in_the_money( $request ) ) {
			return $result;
		}

		list( $agent_id, $verified ) = $this->identify( $request );

		// Circuit breaker (discovery only).
		if ( 'discovery' === $class ) {
			$brk = $this->cache_get( 'brk:' . $agent_id );
			if ( is_array( $brk ) && ! empty( $brk['until'] ) && $brk['until'] > time() ) {
				$b = $this->limit_for( $class, $verified );
				return $this->deny( $class, $b['limit'], 0, $brk['until'] - time(), $brk['until'] );
			}
		}

		$budget = $this->limit_for( $class, $verified );
		$bucket = $this->consume( $agent_id, $class, $budget );

		if ( ! $bucket['ok'] ) {
			if ( 'discovery' === $class ) {
				$this->trip_breaker( $agent_id );
			}
			$reset = time() + $bucket['retry_after'];
			return $this->deny( $class, $budget['limit'], 0, $bucket['retry_after'], $reset );
		}

		// Allowed — reset breaker streak and stash success headers.
		if ( 'discovery' === $class ) {
			$this->cache_delete( 'cb:' . $agent_id );
		}
		$this->applied = array(
			'route'     => $route,
			'limit'     => $budget['limit'],
			'remaining' => (int) floor( $bucket['tokens'] ),
			'reset'     => time() + (int) ceil( ( $budget['burst'] - $bucket['tokens'] ) / max( 0.001, $budget['limit'] / 60 ) ),
			'scope'     => $class,
		);
		return $result;
	}

	/**
	 * Add X-RateLimit-* headers to successful responses on our namespace.
	 *
	 * @param WP_REST_Response $response Response.
	 * @param WP_REST_Server   $server   Server.
	 * @param WP_REST_Request  $request  Request.
	 * @return WP_REST_Response
	 */
	public function attach_headers( $response, $server, $request ) {
		if ( $this->applied && $response instanceof WP_REST_Response && $this->applied['route'] === $request->get_route() ) {
			$response->header( 'X-RateLimit-Limit', $this->applied['limit'] );
			$response->header( 'X-RateLimit-Remaining', $this->applied['remaining'] );
			$response->header( 'X-RateLimit-Reset', $this->applied['reset'] );
			$response->header( 'X-RateLimit-Scope', $this->applied['scope'] );
		}
		return $response;
	}

	/**
	 * Build a readable 429 (Retry-After + rate headers + problem+json w/ scope).
	 *
	 * @param string $scope       Rate-limit class.
	 * @param int    $limit       Budget.
	 * @param int    $remaining   Remaining.
	 * @param int    $retry_after Seconds.
	 * @param int    $reset       Reset unix ts.
	 * @return WP_REST_Response
	 */
	private function deny( $scope, $limit, $remaining, $retry_after, $reset ) {
		$retry_after = max( 1, (int) $retry_after );
		$body = array(
			'type'   => home_url( '/errors/too-many-requests' ),
			'title'  => 'Too Many Requests',
			'detail' => sprintf( '%s budget exceeded. Retry after %ds.', ucfirst( $scope ), $retry_after ),
			'scope'  => $scope,
		);
		$response = new WP_REST_Response( $body, 429 );
		$response->header( 'Content-Type', 'application/problem+json; charset=' . get_option( 'blog_charset' ) );
		$response->header( 'Retry-After', $retry_after );
		$response->header( 'X-RateLimit-Limit', $limit );
		$response->header( 'X-RateLimit-Remaining', max( 0, (int) $remaining ) );
		$response->header( 'X-RateLimit-Reset', (int) $reset );
		$response->header( 'X-RateLimit-Scope', $scope );
		return $response;
	}

	/**
	 * Map a route to its rate-limit class.
	 *
	 * @param string $route REST route.
	 * @return string discovery|cart|checkout
	 */
	private function classify( $route ) {
		if ( preg_match( '#/checkout/?$#', $route ) ) {
			return 'checkout';
		}
		if ( preg_match( '#/(quote|cart)/?$#', $route ) ) {
			return 'cart';
		}
		return 'discovery';
	}

	/**
	 * Is this request "in the money" (mandate / active checkout session)?
	 *
	 * @param WP_REST_Request $request Request.
	 * @return bool
	 */
	private function in_the_money( $request ) {
		$has_auth    = (bool) $request->get_header( 'authorization' );
		$has_mandate = (bool) ( $request->get_param( 'mandate' ) || $request->get_header( 'x-ap2-mandate' ) );
		$has_session = false;
		foreach ( array_keys( (array) $_COOKIE ) as $ck ) {
			if ( 0 === strpos( $ck, 'wp_woocommerce_session_' ) ) {
				$has_session = true;
				break;
			}
		}
		return (bool) apply_filters( 'afs_rate_limit_in_the_money', $has_auth || $has_mandate || $has_session, $request );
	}

	/**
	 * Resolve [ agent_id, verified ]. Verified = signed/authenticated agent.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array{0:string,1:bool}
	 */
	private function identify( $request ) {
		$sig   = $request->get_header( 'signature' ) ?: $request->get_header( 'x-agent-signature' );
		$auth  = $request->get_header( 'authorization' );
		$agent = $request->get_header( 'x-agent-id' ) ?: $request->get_param( 'agent_id' );

		if ( $sig || $auth || $agent ) {
			$seed = $sig ? $sig : ( $auth ? $auth : $agent );
			return array( 'a_' . substr( md5( (string) $seed ), 0, 12 ), true );
		}

		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? wp_unslash( $_SERVER['REMOTE_ADDR'] ) : '0';
		$ua = isset( $_SERVER['HTTP_USER_AGENT'] ) ? wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) : '';

		// A crawler whose IP is confirmed against its operator's published ranges
		// earns the verified tier; a spoofed one stays anonymous.
		$label = '';
		foreach ( AFS_Analytics::AGENTS as $needle => $canon ) {
			if ( false !== stripos( $ua, $needle ) ) {
				$label = $canon;
				break;
			}
		}
		if ( $label && 'verified' === AFS_Bot_Verify::status( $label, $ip ) ) {
			return array( 'bot_' . substr( md5( $label . '|' . $ip ), 0, 12 ), true );
		}

		return array( 'anon_' . substr( md5( $ip . '|' . $ua ), 0, 12 ), false );
	}

	/**
	 * Tier-adjusted [limit, burst] for a class.
	 *
	 * @param string $class    Class.
	 * @param bool   $verified Verified tier.
	 * @return array{limit:int,burst:int}
	 */
	private function limit_for( $class, $verified ) {
		$all = $this->limits();
		$b   = $all[ $class ] ?? $all['discovery'];
		$f   = $verified ? 1.0 : self::ANON_FACTOR;
		return array(
			'limit' => max( 1, (int) round( $b['limit'] * $f ) ),
			'burst' => max( 1, (int) round( $b['burst'] * $f ) ),
		);
	}

	/**
	 * Token-bucket consume of 1 token.
	 *
	 * @param string $agent_id Agent id.
	 * @param string $class    Class.
	 * @param array  $budget   [limit, burst].
	 * @return array{ok:bool,tokens:float,retry_after:int}
	 */
	private function consume( $agent_id, $class, $budget ) {
		$key   = 'rl:' . $agent_id . ':' . $class;
		$now   = microtime( true );
		$rate  = $budget['limit'] / 60.0; // tokens per second.
		$state = $this->cache_get( $key );
		if ( ! is_array( $state ) ) {
			$state = array( 'tokens' => (float) $budget['burst'], 'last' => $now );
		}

		$elapsed = max( 0.0, $now - (float) $state['last'] );
		$tokens  = min( (float) $budget['burst'], (float) $state['tokens'] + $elapsed * $rate );

		if ( $tokens < 1.0 ) {
			$retry = (int) ceil( ( 1.0 - $tokens ) / max( 0.001, $rate ) );
			$this->cache_set( $key, array( 'tokens' => $tokens, 'last' => $now ), 120 );
			return array( 'ok' => false, 'tokens' => $tokens, 'retry_after' => $retry );
		}

		$tokens -= 1.0;
		$this->cache_set( $key, array( 'tokens' => $tokens, 'last' => $now ), 120 );
		return array( 'ok' => true, 'tokens' => $tokens, 'retry_after' => 0 );
	}

	/**
	 * Trip / escalate the discovery circuit breaker for an agent.
	 *
	 * @param string $agent_id Agent id.
	 */
	private function trip_breaker( $agent_id ) {
		$streak = (int) $this->cache_get( 'cb:' . $agent_id ) + 1;
		$this->cache_set( 'cb:' . $agent_id, $streak, 120 );
		if ( $streak < self::CB_THRESHOLD ) {
			return;
		}
		$trips = (int) $this->cache_get( 'cbn:' . $agent_id ) + 1;
		$open  = min( 600, self::CB_BASE * ( 2 ** min( 4, $trips - 1 ) ) ); // exponential reopen, capped 10m.
		$this->cache_set( 'cbn:' . $agent_id, $trips, HOUR_IN_SECONDS );
		$this->cache_set( 'brk:' . $agent_id, array( 'until' => time() + $open ), $open );
	}

	// --- Storage abstraction (persistent object cache preferred) ---

	/** True when a real persistent object cache is present. */
	public static function persistent() {
		return function_exists( 'wp_using_ext_object_cache' ) && wp_using_ext_object_cache();
	}

	private function cache_get( $key ) {
		if ( self::persistent() ) {
			$v = wp_cache_get( $key, self::GROUP );
			return ( false === $v ) ? null : $v;
		}
		$v = get_transient( self::GROUP . '_' . md5( $key ) );
		return ( false === $v ) ? null : $v;
	}

	private function cache_set( $key, $value, $ttl ) {
		if ( self::persistent() ) {
			wp_cache_set( $key, $value, self::GROUP, $ttl );
			return;
		}
		set_transient( self::GROUP . '_' . md5( $key ), $value, $ttl );
	}

	private function cache_delete( $key ) {
		if ( self::persistent() ) {
			wp_cache_delete( $key, self::GROUP );
			return;
		}
		delete_transient( self::GROUP . '_' . md5( $key ) );
	}

	/**
	 * Warn admins when rate limiting is running on the DB-backed fallback.
	 */
	public function degraded_notice() {
		if ( self::persistent() || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		echo '<div class="notice notice-warning"><p><strong>Agent Ready Shop:</strong> ';
		echo esc_html__( 'Rate limiting is running in degraded mode (MySQL transients) because no persistent object cache (Redis/Memcached) was detected. Add one before serving heavy agent traffic.', 'agent-ready-shop' );
		echo '</p></div>';
	}
}
