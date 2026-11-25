<?php
/**
 * Plugin Name: Shopping Bot Optimization (SBO)
 * Plugin URI: https://sbo-analyzer.com
 * Description: Prepares your WooCommerce store for Agentic Commerce (ChatGPT, Gemini, Claude). Generates llms.txt and provides AI bridging capabilities.
 * Version: 1.0.4
 * Author: SBO Team
 * Text Domain: sbo-plugin
 */

if (!defined('ABSPATH')) {
    exit;
}

// 1. Generate llms.txt endpoint
add_action('init', 'sbo_register_llms_endpoint');
function sbo_register_llms_endpoint() {
    add_rewrite_rule('^llms\\.txt$', 'index.php?sbo_llms=1', 'top');
}

add_filter('query_vars', 'sbo_query_vars');
function sbo_query_vars($query_vars) {
    $query_vars[] = 'sbo_llms';
    return $query_vars;
}

add_action('template_redirect', 'sbo_render_llms');
function sbo_render_llms() {
    if (get_query_var('sbo_llms')) {
        header('Content-Type: text/plain; charset=utf-8');
        echo "# Shopping Bot Optimization Manifest\n";
        echo "> This document is primarily optimized for LLMs and AI bots.\n";
        echo "> It contains a structure of major products and purchase policies.\n\n";
        
        echo "## Basic Information\n";
        echo "- Store: " . get_bloginfo('name') . "\n";
        echo "- Description: " . get_bloginfo('description') . "\n";
        
        echo "\n## Categories\n";
        if (class_exists('woocommerce')) {
            $categories = get_terms(['taxonomy' => 'product_cat', 'hide_empty' => true]);
            if (!is_wp_error($categories) && !empty($categories)) {
                foreach ($categories as $cat) {
                    echo "- [" . $cat->name . "](" . get_term_link($cat) . ")\n";
                }
            } else {
                echo "- No categories found.\n";
            }
        } else {
             echo "- WooCommerce is not active.\n";
        }
        
        echo "\n## Policies and Conditions for Agents\n";
        echo "Purchasing is possible directly via WebMCP (requires PRO version).\n";
        exit;
    }
}

// 2. Flush rewrite rules on activation
register_activation_hook(__FILE__, 'sbo_plugin_activate');
function sbo_plugin_activate() {
    sbo_register_llms_endpoint();
    flush_rewrite_rules();
}

// 3. Add Settings Menu (Demo)
add_action('admin_menu', 'sbo_add_admin_menu');
function sbo_add_admin_menu() {
    add_menu_page(
        'Shopping Bot Optimization',
        'SBO Plugin',
        'manage_options',
        'sbo-settings',
        'sbo_settings_page',
        'dashicons-robot',
        58
    );
}

function sbo_settings_page() {
    ?>
    <div class="wrap" style="background: #fff; padding: 20px; border: 1px solid #c3c4c7; box-shadow: 0 1px 1px rgba(0,0,0,.04); max-width: 800px; margin-top: 20px;">
        <h1 style="border-bottom: 1px solid #eee; padding-bottom: 15px;">Shopping Bot Optimization (SBO)</h1>
        
        <div style="background: #eef2f5; border-left: 4px solid #2271b1; padding: 12px 15px; margin-top: 20px;">
            <p style="margin: 0;"><strong>AIO (AI Optimization) Status:</strong> Your store is now partially visible to AI bots thanks to llms.txt!</p>
        </div>

        <h2 style="margin-top: 30px;">llms.txt Generator (Active)</h2>
        <p>The manifest file for AI Crawlers has been successfully generated.</p>
        <p>URL for crawlers: <a href="<?php echo site_url('/llms.txt'); ?>" target="_blank" style="font-family: monospace; font-weight: bold;"><?php echo site_url('/llms.txt'); ?></a></p>
        
        <h2 style="margin-top: 30px; color: #1d2327;">WebMCP Transaction Bridge (PRO)</h2>
        <div style="border: 1px solid #f8c4c6; background: #fcf0f1; padding: 15px; border-radius: 4px;">
            <p style="color: #d63638; font-weight: 600; margin-top: 0;">SBO PRO Required</p>
            <p style="margin-bottom: 0;">To unlock the ability for bots to insert products directly into the cart and complete purchases without human interaction, upgrade to the PRO version.</p>
        </div>
    </div>
    <?php
}
