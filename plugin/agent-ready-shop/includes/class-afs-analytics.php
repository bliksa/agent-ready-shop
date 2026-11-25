<?php
/**
 * AI traffic analytics.
 *
 * Records front-end requests that come from known AI agents (by User-Agent) or
 * are referred from AI assistants (by Referer), keeping a rolling 30-day tally.
 * Normal human traffic never matches, so nothing else is logged.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Analytics {

	const OPTION = 'afs_analytics';
	const DAYS   = 30;

	/** User-Agent substring => canonical agent label. */
	const AGENTS = array(
		'GPTBot'             => 'GPTBot',
		'OAI-SearchBot'      => 'OAI-SearchBot',
		'ChatGPT-User'       => 'ChatGPT-User',
		'ClaudeBot'          => 'ClaudeBot',
		'Claude-User'        => 'Claude-User',
		'anthropic-ai'       => 'anthropic-ai',
		'PerplexityBot'      => 'PerplexityBot',
		'Perplexity-User'    => 'Perplexity-User',
		'Google-Extended'    => 'Google-Extended',
		'Applebot-Extended'  => 'Applebot-Extended',
		'Amazonbot'          => 'Amazonbot',
		'Meta-ExternalAgent' => 'Meta-ExternalAgent',
		'Bytespider'         => 'Bytespider',
		'CCBot'              => 'CCBot',
	);

	/** Referer host substring => AI assistant label. */
	const REFERRERS = array(
		'chatgpt.com'         => 'ChatGPT',
		'chat.openai.com'     => 'ChatGPT',
		'perplexity.ai'       => 'Perplexity',
		'gemini.google.com'   => 'Gemini',
		'claude.ai'           => 'Claude',
		'copilot.microsoft.com' => 'Copilot',
	);

	/**
	 * Register hooks.
	 */
	public function hooks() {
		if ( ! AFS_Settings::get( 'enable_analytics' ) ) {
			return;
		}
		// Priority 1 so it runs before virtual files (llms.txt/manifest) exit.
		add_action( 'init', array( $this, 'maybe_record' ), 1 );
	}

	/**
	 * Record the current request if it is AI-originated.
	 */
	public function maybe_record() {
		if ( is_admin() || ( function_exists( 'wp_doing_cron' ) && wp_doing_cron() ) || ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) ) {
			return;
		}

		$ua  = isset( $_SERVER['HTTP_USER_AGENT'] ) ? wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) : '';
		$ref = isset( $_SERVER['HTTP_REFERER'] ) ? wp_unslash( $_SERVER['HTTP_REFERER'] ) : '';

		$agent = $this->match( $ua, self::AGENTS );
		$src   = $ref ? $this->match( $ref, self::REFERRERS ) : '';
		if ( ! $agent && ! $src ) {
			return;
		}

		$path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH ) : '/';
		$path = $this->norm_path( $path );

		$data  = (array) get_option( self::OPTION, array() );
		$today = gmdate( 'Y-m-d' );
		if ( empty( $data[ $today ] ) ) {
			$data[ $today ] = array( 'total' => 0, 'agents' => array(), 'referrals' => array(), 'pages' => array(), 'cited' => array(), 'verified' => 0, 'spoofed' => 0 );
		}

		$data[ $today ]['total']++;
		if ( $agent ) {
			$data[ $today ]['agents'][ $agent ] = ( $data[ $today ]['agents'][ $agent ] ?? 0 ) + 1;
			// Which pages agents actually read.
			$this->bump( $data[ $today ]['pages'], $path );

			// Verified-bot / spoof detection (real operator IP?).
			$ip     = isset( $_SERVER['REMOTE_ADDR'] ) ? wp_unslash( $_SERVER['REMOTE_ADDR'] ) : '';
			$status = AFS_Bot_Verify::status( $agent, $ip );
			if ( 'verified' === $status ) {
				$data[ $today ]['verified']++;
			} elseif ( 'spoofed' === $status ) {
				$data[ $today ]['spoofed']++;
			}
		}
		if ( $src ) {
			$data[ $today ]['referrals'][ $src ] = ( $data[ $today ]['referrals'][ $src ] ?? 0 ) + 1;
			// Which pages AI assistants cite (human landed here from a citation).
			$this->bump( $data[ $today ]['cited'], $path );
		}

		// Prune anything older than the rolling window.
		$cutoff = gmdate( 'Y-m-d', time() - self::DAYS * DAY_IN_SECONDS );
		foreach ( array_keys( $data ) as $day ) {
			if ( $day < $cutoff ) {
				unset( $data[ $day ] );
			}
		}

		update_option( self::OPTION, $data, false );
	}

	/**
	 * First matching label whose key appears (case-insensitive) in the haystack.
	 *
	 * @param string $haystack Subject.
	 * @param array  $map      Needle => label.
	 * @return string
	 */
	private function match( $haystack, $map ) {
		foreach ( $map as $needle => $label ) {
			if ( false !== stripos( $haystack, $needle ) ) {
				return $label;
			}
		}
		return '';
	}

	/** Normalize a request path for grouping (trim, cap length). */
	private function norm_path( $path ) {
		$path = '/' . ltrim( (string) $path, '/' );
		return substr( $path, 0, 100 );
	}

	/** Increment a counter map, keeping it bounded to the 40 busiest keys. */
	private function bump( &$map, $key ) {
		$map[ $key ] = ( $map[ $key ] ?? 0 ) + 1;
		if ( count( $map ) > 60 ) {
			arsort( $map );
			$map = array_slice( $map, 0, 40, true );
		}
	}

	/**
	 * Aggregated summary for the rolling window.
	 *
	 * @return array{total:int,agents:array,referrals:array,days:array}
	 */
	public static function summary() {
		$data      = (array) get_option( self::OPTION, array() );
		$total     = 0;
		$verified  = 0;
		$spoofed   = 0;
		$agents    = array();
		$referrals = array();
		$pages     = array();
		$cited     = array();
		$series    = array();

		$acc = function ( &$dst, $rows ) {
			foreach ( (array) $rows as $k => $v ) {
				$dst[ $k ] = ( $dst[ $k ] ?? 0 ) + (int) $v;
			}
		};

		ksort( $data );
		foreach ( $data as $day => $row ) {
			$total   += (int) ( $row['total'] ?? 0 );
			$verified += (int) ( $row['verified'] ?? 0 );
			$spoofed += (int) ( $row['spoofed'] ?? 0 );
			$series[ $day ] = (int) ( $row['total'] ?? 0 );
			$acc( $agents, $row['agents'] ?? array() );
			$acc( $referrals, $row['referrals'] ?? array() );
			$acc( $pages, $row['pages'] ?? array() );
			$acc( $cited, $row['cited'] ?? array() );
		}

		arsort( $agents );
		arsort( $referrals );
		arsort( $pages );
		arsort( $cited );

		return array(
			'total'     => $total,
			'verified'  => $verified,
			'spoofed'   => $spoofed,
			'agents'    => $agents,
			'referrals' => $referrals,
			'pages'     => $pages,
			'cited'     => $cited,
			'days'      => $series,
		);
	}

	/**
	 * Export the rolling window as CSV rows (metric, key, count).
	 *
	 * @return string
	 */
	public static function export_csv() {
		$s   = self::summary();
		$out = "metric,key,count\n";
		$out .= 'summary,total,' . (int) $s['total'] . "\n";
		$out .= 'summary,verified,' . (int) $s['verified'] . "\n";
		$out .= 'summary,spoofed,' . (int) $s['spoofed'] . "\n";
		foreach ( array( 'agents', 'referrals', 'pages', 'cited' ) as $metric ) {
			foreach ( $s[ $metric ] as $k => $v ) {
				$out .= $metric . ',"' . str_replace( '"', '""', (string) $k ) . '",' . (int) $v . "\n";
			}
		}
		return $out;
	}
}
