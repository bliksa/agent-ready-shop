<?php
/**
 * Verified-bot / spoof detection.
 *
 * Confirms that a request claiming to be an AI agent (by User-Agent) really
 * originates from that operator, by matching the client IP against the
 * operator's published IP ranges. This is what lets us:
 *   - flag spoofed GPTBot/ClaudeBot traffic in analytics, and
 *   - grant the rate limiter's "verified" tier only to real agents.
 *
 * Everything runs locally; range lists are cached 24h, per-IP results 1h.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Bot_Verify {

	/** Agent label => published IP-range JSON (Google/OpenAI "prefixes" format). */
	private static function sources() {
		return apply_filters( 'afs_bot_ranges', array(
			'GPTBot'          => 'https://openai.com/gptbot.json',
			'OAI-SearchBot'   => 'https://openai.com/searchbot.json',
			'ChatGPT-User'    => 'https://openai.com/chatgpt-user.json',
			'PerplexityBot'   => 'https://www.perplexity.ai/perplexitybot.json',
			'Google-Extended' => 'https://developers.google.com/static/search/apis/ipranges/googlebot.json',
			'Bingbot'         => 'https://www.bing.com/toolbox/bingbot.json',
		) );
	}

	/**
	 * Verify a claimed agent against the client IP.
	 *
	 * @param string $label Canonical agent label.
	 * @param string $ip    Client IP.
	 * @return string 'verified' | 'spoofed' | 'unknown'
	 */
	public static function status( $label, $ip ) {
		$sources = self::sources();
		if ( empty( $sources[ $label ] ) || ! $ip ) {
			return 'unknown';
		}

		$cache_key = 'afs_botv_' . md5( $label . '|' . $ip );
		$cached    = get_transient( $cache_key );
		if ( false !== $cached ) {
			return $cached;
		}

		$ranges = self::ranges( $label, $sources[ $label ] );
		$status = 'unknown';
		if ( ! empty( $ranges ) ) {
			$status = 'spoofed';
			foreach ( $ranges as $cidr ) {
				if ( self::in_range( $ip, $cidr ) ) {
					$status = 'verified';
					break;
				}
			}
		}

		set_transient( $cache_key, $status, HOUR_IN_SECONDS );
		return $status;
	}

	/**
	 * Fetch + cache an operator's CIDR list.
	 *
	 * @param string $label Agent.
	 * @param string $url    Ranges URL.
	 * @return string[]
	 */
	private static function ranges( $label, $url ) {
		$key    = 'afs_ranges_' . md5( $label );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$out = array();
		$res = wp_remote_get( $url, array( 'timeout' => 4 ) );
		if ( ! is_wp_error( $res ) && 200 === (int) wp_remote_retrieve_response_code( $res ) ) {
			$data = json_decode( wp_remote_retrieve_body( $res ), true );
			if ( isset( $data['prefixes'] ) && is_array( $data['prefixes'] ) ) {
				foreach ( $data['prefixes'] as $p ) {
					if ( ! empty( $p['ipv4Prefix'] ) ) {
						$out[] = $p['ipv4Prefix'];
					} elseif ( ! empty( $p['ipv6Prefix'] ) ) {
						$out[] = $p['ipv6Prefix'];
					}
				}
			}
		}

		// Cache even an empty result briefly to avoid hammering a flaky source.
		set_transient( $key, $out, $out ? DAY_IN_SECONDS : 2 * HOUR_IN_SECONDS );
		return $out;
	}

	/**
	 * Is an IP inside a CIDR (v4 or v6)?
	 *
	 * @param string $ip   IP.
	 * @param string $cidr CIDR.
	 * @return bool
	 */
	private static function in_range( $ip, $cidr ) {
		if ( false === strpos( $cidr, '/' ) ) {
			return false;
		}
		return ( false !== strpos( $ip, ':' ) ) ? self::in_v6( $ip, $cidr ) : self::in_v4( $ip, $cidr );
	}

	private static function in_v4( $ip, $cidr ) {
		list( $net, $bits ) = explode( '/', $cidr );
		$ipl  = ip2long( $ip );
		$netl = ip2long( $net );
		if ( false === $ipl || false === $netl ) {
			return false;
		}
		$mask = -1 << ( 32 - (int) $bits );
		return ( $ipl & $mask ) === ( $netl & $mask );
	}

	private static function in_v6( $ip, $cidr ) {
		list( $net, $bits ) = explode( '/', $cidr );
		$ipb  = @inet_pton( $ip );
		$netb = @inet_pton( $net );
		if ( false === $ipb || false === $netb || 16 !== strlen( $ipb ) || 16 !== strlen( $netb ) ) {
			return false;
		}
		$bits  = (int) $bits;
		$bytes = intdiv( $bits, 8 );
		$rem   = $bits % 8;
		if ( $bytes && 0 !== strncmp( $ipb, $netb, $bytes ) ) {
			return false;
		}
		if ( $rem ) {
			$m = chr( ( 0xff << ( 8 - $rem ) ) & 0xff );
			return ( ord( $ipb[ $bytes ] ) & ord( $m ) ) === ( ord( $netb[ $bytes ] ) & ord( $m ) );
		}
		return true;
	}
}
