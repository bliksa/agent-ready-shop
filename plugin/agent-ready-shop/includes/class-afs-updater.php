<?php
/**
 * Premium: automatic updates from a self-hosted update source.
 *
 * Only active when the license unlocks the "au" feature. Checks a remote JSON
 * document (filterable via `afs_update_url`) shaped like:
 *
 *   { "version": "1.1.0", "download_url": "https://.../agent-ready-shop.zip",
 *     "tested": "6.6", "requires": "6.0", "requires_php": "7.4" }
 *
 * With no URL configured it does nothing — the plumbing and license gate are
 * what matter here.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Updater {

	/**
	 * Register hooks (self-gated on the license).
	 */
	public function hooks() {
		if ( ! AFS_License::can( 'au' ) ) {
			return;
		}
		add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check' ) );
		add_filter( 'plugins_api', array( $this, 'info' ), 10, 3 );
	}

	/**
	 * The configured update endpoint.
	 *
	 * @return string
	 */
	private function url() {
		return (string) apply_filters( 'afs_update_url', defined( 'AFS_UPDATE_URL' ) ? AFS_UPDATE_URL : '' );
	}

	/**
	 * Fetch and cache the remote release metadata.
	 *
	 * @return array|null
	 */
	private function remote() {
		$url = $this->url();
		if ( '' === $url ) {
			return null;
		}
		$cached = get_transient( 'afs_update_meta' );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$res = wp_remote_get( $url, array( 'timeout' => 8 ) );
		if ( is_wp_error( $res ) || 200 !== (int) wp_remote_retrieve_response_code( $res ) ) {
			return null;
		}
		$data = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( ! is_array( $data ) || empty( $data['version'] ) || ! is_string( $data['version'] ) ) {
			return null;
		}
		// The package must come over HTTPS from the same host as the manifest, so
		// a tampered or mistaken manifest cannot point WordPress at a foreign zip.
		$package = isset( $data['download_url'] ) ? (string) $data['download_url'] : '';
		if ( 'https' !== wp_parse_url( $package, PHP_URL_SCHEME ) || wp_parse_url( $package, PHP_URL_HOST ) !== wp_parse_url( $url, PHP_URL_HOST ) ) {
			return null;
		}
		set_transient( 'afs_update_meta', $data, 6 * HOUR_IN_SECONDS );
		return $data;
	}

	/**
	 * Inject an available update into the update transient.
	 *
	 * @param mixed $transient Update transient.
	 * @return mixed
	 */
	public function check( $transient ) {
		if ( empty( $transient->checked ) ) {
			return $transient;
		}
		$data = $this->remote();
		if ( ! $data || version_compare( $data['version'], AFS_VERSION, '<=' ) ) {
			return $transient;
		}

		$slug = 'agent-ready-shop';
		$transient->response[ $slug . '/agent-ready-shop.php' ] = (object) array(
			'slug'        => $slug,
			'plugin'      => $slug . '/agent-ready-shop.php',
			'new_version' => $data['version'],
			'package'     => $data['download_url'] ?? '',
			'tested'      => $data['tested'] ?? '',
			'requires'    => $data['requires'] ?? '',
			'requires_php' => $data['requires_php'] ?? '',
			'url'         => AFS_VERIFY_BASE . '/',
		);
		return $transient;
	}

	/**
	 * Provide the "View details" popup content.
	 *
	 * @param mixed  $result Default result.
	 * @param string $action Requested action.
	 * @param object $args   Request args.
	 * @return mixed
	 */
	public function info( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || empty( $args->slug ) || 'agent-ready-shop' !== $args->slug ) {
			return $result;
		}
		$data = $this->remote();
		if ( ! $data ) {
			return $result;
		}
		return (object) array(
			'name'          => 'Agent Ready Shop',
			'slug'          => 'agent-ready-shop',
			'version'       => $data['version'],
			'requires'      => $data['requires'] ?? '',
			'tested'        => $data['tested'] ?? '',
			'download_link' => $data['download_url'] ?? '',
			'sections'      => array( 'changelog' => $data['changelog'] ?? '' ),
		);
	}
}
