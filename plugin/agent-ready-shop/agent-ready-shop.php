<?php
/**
 * Plugin Name:       Agent Ready Shop
 * Plugin URI:        https://agentreadyshop.com
 * Description:       Makes a WooCommerce store maximally legible to AI shopping agents and mints a verifiable "Agent Ready Certified" trust badge: Schema.org structured data, a machine-readable product feed/API, an llms.txt manifest, a /.well-known discovery document, an OpenAPI spec, explicit AI-crawler permissions, and an embeddable certificate badge.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Agent Ready Shop
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       agent-ready-shop
 *
 * WC requires at least: 6.0
 * WC tested up to:      9.9
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

define( 'AFS_VERSION', '1.0.0' );
define( 'AFS_FILE', __FILE__ );
define( 'AFS_DIR', plugin_dir_path( __FILE__ ) );
define( 'AFS_URL', plugin_dir_url( __FILE__ ) );
define( 'AFS_REST_NAMESPACE', 'agent-shop/v1' );
define( 'AFS_VERIFY_BASE', 'https://agentreadyshop.com' );
// Auto-update source (Pro). Point at your Agent Ready Shop service; filter with `afs_update_url`.
define( 'AFS_UPDATE_URL', 'https://agentreadyshop.com/api/update/agent-ready-shop.json' );

require_once AFS_DIR . 'includes/class-afs-settings.php';
require_once AFS_DIR . 'includes/class-afs-license.php';
require_once AFS_DIR . 'includes/class-afs-score.php';
require_once AFS_DIR . 'includes/class-afs-bot-verify.php';
require_once AFS_DIR . 'includes/class-afs-analytics.php';
require_once AFS_DIR . 'includes/class-afs-certificate.php';
require_once AFS_DIR . 'includes/class-afs-checkout.php';
require_once AFS_DIR . 'includes/class-afs-rate-limiter.php';
require_once AFS_DIR . 'includes/class-afs-discovery.php';
require_once AFS_DIR . 'includes/class-afs-rest-api.php';
require_once AFS_DIR . 'includes/class-afs-structured-data.php';
require_once AFS_DIR . 'includes/class-afs-updater.php';
require_once AFS_DIR . 'includes/class-afs-admin.php';

/**
 * Boot the plugin once all plugins (incl. WooCommerce) are loaded.
 */
function afs_bootstrap() {
	( new AFS_Discovery() )->hooks();
	( new AFS_REST_API() )->hooks();
	( new AFS_Structured_Data() )->hooks();
	( new AFS_Updater() )->hooks();
	( new AFS_Certificate() )->hooks();
	( new AFS_Analytics() )->hooks();
	( new AFS_Checkout() )->hooks();
	( new AFS_Rate_Limiter() )->hooks();

	if ( is_admin() ) {
		( new AFS_Admin() )->hooks();
	}
}
add_action( 'plugins_loaded', 'afs_bootstrap' );

/**
 * Declare compatibility with WooCommerce High-Performance Order Storage.
 */
add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', AFS_FILE, true );
	}
} );

/**
 * Admin notice when WooCommerce is missing. The plugin still serves
 * site-level discovery files, but product data will be empty.
 */
add_action( 'admin_notices', function () {
	if ( class_exists( 'WooCommerce' ) ) {
		return;
	}
	echo '<div class="notice notice-warning"><p>';
	echo esc_html__( 'Agent Ready Shop is active, but WooCommerce was not detected. Discovery files are served, but the product feed will be empty until WooCommerce is installed.', 'agent-ready-shop' );
	echo '</p></div>';
} );

// Flush rewrite handling is not required: virtual files are served on `init`.
register_activation_hook( __FILE__, 'afs_bootstrap' );
