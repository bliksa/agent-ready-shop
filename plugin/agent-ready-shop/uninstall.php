<?php
/**
 * Uninstall handler: remove options and transients created by the plugin.
 *
 * @package AgentReadyShop
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'afs_settings' );
delete_option( 'afs_cache_version' );
delete_option( 'afs_license_key' );
delete_option( 'afs_analytics' );
delete_transient( 'afs_health_checks' );
delete_transient( 'afs_update_meta' );
