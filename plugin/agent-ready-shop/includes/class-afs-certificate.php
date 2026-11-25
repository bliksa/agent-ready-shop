<?php
/**
 * Agent Ready certificate + embeddable trust badge.
 *
 * The certificate ID is derived deterministically from the store domain using
 * the SAME algorithm as the Agent Ready Shop web service (src/utils/badge.ts),
 * so any badge this plugin emits verifies against agentreadyshop.com/verify
 * without a shared database.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Certificate {

	const SECRET = 'agent-ready-shop:v1';

	/**
	 * Register hooks.
	 */
	public function hooks() {
		add_shortcode( 'agent_ready_badge', array( $this, 'shortcode' ) );

		if ( AFS_License::is_pro() && AFS_Settings::get( 'show_badge' ) ) {
			add_action( 'wp_footer', array( $this, 'render_footer_badge' ) );
		}
	}

	/** Normalized store domain (host only, no www). */
	public static function domain() {
		$host = (string) wp_parse_url( home_url(), PHP_URL_HOST );
		return preg_replace( '/^www\./', '', strtolower( $host ) );
	}

	/**
	 * AIO score the store advertises. The plugin delivers robots + llms +
	 * schema + API + feed (85); the verifiable certificate adds the final 15.
	 *
	 * @return int
	 */
	public static function score() {
		return AFS_Score::value();
	}

	/** Certificate tier from score. */
	public static function tier() {
		return AFS_Score::tier();
	}

	/** Deterministic certificate ID (matches the web service). */
	public static function cert_id() {
		$d = self::domain();
		return 'ARS-' . self::b36( self::djb2( $d ) ) . '-' . self::b36( self::djb2( self::SECRET . $d ) );
	}

	/** Public verification URL. */
	public static function verify_url() {
		return AFS_VERIFY_BASE . '/verify/' . self::cert_id() . '?d=' . rawurlencode( self::domain() ) . '&s=' . self::score();
	}

	/** Hosted badge image URL. */
	public static function badge_url( $style = 'dark' ) {
		$style = ( 'light' === $style ) ? 'light' : 'dark';
		return AFS_VERIFY_BASE . '/api/badge?d=' . rawurlencode( self::domain() ) . '&s=' . self::score() . '&style=' . $style;
	}

	/** The embed HTML a store owner can paste anywhere. */
	public static function embed_html( $style = 'dark' ) {
		return '<a href="' . esc_url( self::verify_url() ) . '" target="_blank" rel="noopener">'
			. '<img src="' . esc_url( self::badge_url( $style ) ) . '" alt="Agent Ready Certified" width="240" height="56" loading="lazy" />'
			. '</a>';
	}

	/**
	 * Certificate block for the /.well-known manifest. Null until Pro-licensed.
	 *
	 * @return array|null
	 */
	public static function manifest_data() {
		if ( ! AFS_License::is_pro() ) {
			return null;
		}
		return array(
			'id'         => self::cert_id(),
			'tier'       => self::tier(),
			'score'      => self::score(),
			'verify_url' => self::verify_url(),
			'badge_url'  => self::badge_url(),
		);
	}

	/**
	 * [agent_ready_badge style="dark|light"]
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string
	 */
	public function shortcode( $atts ) {
		$atts = shortcode_atts( array( 'style' => 'dark' ), $atts, 'agent_ready_badge' );
		if ( ! AFS_License::is_pro() ) {
			return '';
		}
		return self::embed_html( $atts['style'] );
	}

	/** Floating footer badge on the storefront. */
	public function render_footer_badge() {
		echo '<div style="position:fixed;right:16px;bottom:16px;z-index:9999;filter:drop-shadow(0 2px 8px rgba(0,0,0,.18))">'
			. self::embed_html( 'dark' ) // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built with esc_url internally.
			. '</div>';
	}

	// --- Deterministic helpers (parity with src/utils/badge.ts) ---

	/**
	 * djb2 multiply variant, reduced mod 2^32.
	 *
	 * @param string $str Input.
	 * @return int
	 */
	private static function djb2( $str ) {
		$h   = 5381;
		$len = strlen( $str );
		for ( $i = 0; $i < $len; $i++ ) {
			$h = ( $h * 33 + ord( $str[ $i ] ) ) % 4294967296;
		}
		return (int) $h;
	}

	/**
	 * Encode an integer as 6-char uppercase base36.
	 *
	 * @param int $n Number.
	 * @return string
	 */
	private static function b36( $n ) {
		$s = strtoupper( base_convert( (string) $n, 10, 36 ) );
		return substr( str_pad( $s, 6, '0', STR_PAD_LEFT ), -6 );
	}
}
