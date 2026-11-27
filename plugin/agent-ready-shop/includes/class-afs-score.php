<?php
/**
 * Setup score (0..100): how much of the plugin's agent layer is switched on,
 * derived from the plugin's own configuration. It is a checklist for the
 * merchant. The PUBLIC score on the badge and verification page is measured
 * independently by the Agent Ready Shop service's live audit and can differ.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Score {

	/**
	 * Per-signal breakdown => [ points, max, label ].
	 *
	 * @return array<string,array{0:int,1:int,2:string}>
	 */
	public static function breakdown() {
		$json_ld = (bool) AFS_Settings::get( 'enable_json_ld' );
		$xml     = (bool) AFS_Settings::get( 'enable_xml_feed' );
		$pro     = AFS_License::is_pro();

		return array(
			// Free tier — "get discovered" (max 50).
			// WordPress serves "Disallow: /" to everyone while "Discourage search engines" is on.
			'robots'   => array( get_option( 'blog_public' ) ? 15 : 0, 15, __( 'AI agent access (robots.txt)', 'agent-ready-shop' ), 'free' ),
			'llms'     => array( 10, 10, __( 'llms.txt manifest', 'agent-ready-shop' ), 'free' ),
			'schema'   => array( $json_ld ? 10 : 0, 10, __( 'Product JSON-LD schema', 'agent-ready-shop' ), 'free' ),
			'api'      => array( 15, 15, __( 'Read-only Agent Commerce API', 'agent-ready-shop' ), 'free' ),
			// Pro tier — "get bought" + measure + trust (max 50).
			'checkout' => array( AFS_License::can( 'ck' ) ? 20 : 0, 20, __( 'Agentic checkout (cart & order API)', 'agent-ready-shop' ), 'pro' ),
			'schemax'  => array( ( $pro && $json_ld ) ? 10 : 0, 10, __( 'Enriched schema (returns & shipping)', 'agent-ready-shop' ), 'pro' ),
			'feed'     => array( ( AFS_License::can( 'xf' ) && $xml ) ? 10 : 0, 10, __( 'Full Google / XML product feed', 'agent-ready-shop' ), 'pro' ),
			'analytics'=> array( AFS_License::can( 'an' ) ? 10 : 0, 10, __( 'Advanced AI analytics', 'agent-ready-shop' ), 'pro' ),
		);
	}

	/**
	 * Total AIO score (0..100).
	 *
	 * @return int
	 */
	public static function value() {
		$total = 0;
		foreach ( self::breakdown() as $row ) {
			$total += (int) $row[0];
		}
		return min( 100, $total );
	}

	/**
	 * Tier from a score.
	 *
	 * @param int|null $score Optional score, defaults to current.
	 * @return string gold|blue|none
	 */
	public static function tier( $score = null ) {
		$s = ( null === $score ) ? self::value() : (int) $score;
		if ( $s >= 85 ) {
			return 'gold';
		}
		return $s >= 60 ? 'blue' : 'none';
	}
}
