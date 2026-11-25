<?php
/**
 * Settings store with typed accessors and defaults.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Settings {

	const OPTION = 'afs_settings';

	/**
	 * Default option values.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'enable_json_ld'    => 1,
			'disable_wc_schema' => 0,
			'enable_xml_feed'   => 1,
			'cache_ttl'         => 3600,
			'feed_max_items'    => 500,
			'show_badge'        => 1,
			'enable_analytics'  => 1,
			'enable_rate_limit' => 1,
			'block_training_bots' => 0,
			'llms_intro'        => '',
			'allowed_agents'    => "GPTBot\nOAI-SearchBot\nChatGPT-User\nClaudeBot\nClaude-User\nanthropic-ai\nPerplexityBot\nPerplexity-User\nGoogle-Extended\nApplebot-Extended",
		);
	}

	/**
	 * All settings merged with defaults.
	 *
	 * @return array
	 */
	public static function all() {
		return wp_parse_args( (array) get_option( self::OPTION, array() ), self::defaults() );
	}

	/**
	 * Single setting.
	 *
	 * @param string $key Setting key.
	 * @return mixed
	 */
	public static function get( $key ) {
		$all = self::all();
		return array_key_exists( $key, $all ) ? $all[ $key ] : null;
	}

	/**
	 * Allowed AI user-agents as a clean list.
	 *
	 * @return string[]
	 */
	public static function allowed_agents() {
		$raw  = (string) self::get( 'allowed_agents' );
		$list = array_filter( array_map( 'trim', preg_split( '/[\r\n,]+/', $raw ) ) );
		return array_values( $list );
	}

	/**
	 * Sanitize the settings array on save.
	 *
	 * @param array $input Raw input.
	 * @return array
	 */
	public static function sanitize( $input ) {
		$out = array();
		$out['enable_json_ld']    = empty( $input['enable_json_ld'] ) ? 0 : 1;
		$out['disable_wc_schema'] = empty( $input['disable_wc_schema'] ) ? 0 : 1;
		$out['enable_xml_feed']   = empty( $input['enable_xml_feed'] ) ? 0 : 1;
		$out['cache_ttl']         = max( 0, absint( $input['cache_ttl'] ?? 3600 ) );
		$out['feed_max_items']    = min( 5000, max( 10, absint( $input['feed_max_items'] ?? 500 ) ) );
		$out['show_badge']        = empty( $input['show_badge'] ) ? 0 : 1;
		$out['enable_analytics']  = empty( $input['enable_analytics'] ) ? 0 : 1;
		$out['enable_rate_limit'] = empty( $input['enable_rate_limit'] ) ? 0 : 1;
		$out['block_training_bots'] = empty( $input['block_training_bots'] ) ? 0 : 1;
		$out['llms_intro']        = sanitize_textarea_field( $input['llms_intro'] ?? '' );
		$out['allowed_agents']    = sanitize_textarea_field( $input['allowed_agents'] ?? '' );
		return $out;
	}
}
