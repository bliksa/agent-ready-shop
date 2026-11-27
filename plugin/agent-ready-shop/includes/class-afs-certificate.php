<?php
/**
 * Agent Ready certificate + embeddable trust badge.
 *
 * The badge image and the verification page are served by the Agent Ready Shop
 * service (AFS_SERVICE_URL). Both show the result of the service's OWN live
 * audit of this store: the plugin only passes the store domain, never a score.
 * The certificate ID is a reference label derived from the domain (same
 * algorithm as src/utils/badge.ts); it is not a secret and proves nothing.
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

	/** Deterministic certificate ID (matches the web service). */
	public static function cert_id() {
		$d = self::domain();
		return 'ARS-' . self::b36( self::djb2( $d ) ) . '-' . self::b36( self::djb2( self::SECRET . $d ) );
	}

	/** Public verification URL. */
	public static function verify_url() {
		return AFS_VERIFY_BASE . '/verify.php?d=' . rawurlencode( self::domain() );
	}

	/** Hosted badge image URL. */
	public static function badge_url( $style = 'dark' ) {
		$style = ( 'light' === $style ) ? 'light' : 'dark';
		return AFS_VERIFY_BASE . '/badge.php?d=' . rawurlencode( self::domain() ) . '&style=' . $style;
	}

	/** The embed HTML a store owner can paste anywhere. */
	public static function embed_html( $style = 'dark' ) {
		return '<a href="' . esc_url( self::verify_url() ) . '" target="_blank" rel="noopener">'
			. '<img src="' . esc_url( self::badge_url( $style ) ) . '" alt="Agent Ready — live audit result" width="240" height="56" loading="lazy" />'
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
			// No self-declared score or tier: the verify page reports the live-audited ones.
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
