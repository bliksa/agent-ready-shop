<?php
/**
 * Discovery surfaces: /llms.txt, /.well-known/agent-shop.json, robots.txt,
 * and a Google Merchant-style XML product feed.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Discovery {

	/**
	 * Register hooks.
	 */
	public function hooks() {
		add_action( 'init', array( $this, 'serve_virtual_files' ) );
		add_filter( 'robots_txt', array( $this, 'robots_txt' ), 10, 2 );
	}

	/**
	 * Intercept requests for virtual root-level files.
	 */
	public function serve_virtual_files() {
		$uri  = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$path = untrailingslashit( wp_parse_url( $uri, PHP_URL_PATH ) ?? '' );

		switch ( $path ) {
			case '/llms.txt':
				$this->output( 'text/plain; charset=utf-8', $this->llms_txt() );
				break;
			case '/.well-known/agent-shop.json':
			case '/agent-shop.json':
				$this->output( 'application/json; charset=utf-8', wp_json_encode( self::get_manifest(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
				break;
			case '/agent-shop-feed.xml':
				if ( AFS_Settings::get( 'enable_xml_feed' ) ) {
					$this->output( 'application/xml; charset=utf-8', $this->xml_feed() );
				}
				break;
		}
	}

	/**
	 * Emit a virtual file and stop.
	 *
	 * @param string $content_type HTTP content type.
	 * @param string $body         Response body.
	 */
	private function output( $content_type, $body ) {
		if ( headers_sent() ) {
			return;
		}
		status_header( 200 );
		header( 'Content-Type: ' . $content_type );
		header( 'X-Robots-Tag: index, follow' );
		header( 'Cache-Control: public, max-age=3600' );
		echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- pre-built feed body.
		exit;
	}

	/**
	 * The machine-readable site manifest (also served at the REST /manifest route).
	 *
	 * @return array
	 */
	public static function get_manifest() {
		$has_wc = function_exists( 'wc_get_products' );
		$ns     = AFS_REST_NAMESPACE;

		$endpoints = array(
			'manifest'   => rest_url( $ns . '/manifest' ),
			'products'   => rest_url( $ns . '/products' ),
			'product'    => rest_url( $ns . '/products/{id}' ),
			'search'     => add_query_arg( 'search', '{query}', rest_url( $ns . '/products' ) ),
			'categories' => rest_url( $ns . '/categories' ),
			'openapi'    => rest_url( $ns . '/openapi.json' ),
			'store_api_cart'     => $has_wc ? rest_url( 'wc/store/v1/cart' ) : null,
			'store_api_checkout' => $has_wc ? rest_url( 'wc/store/v1/checkout' ) : null,
		);
		if ( AFS_Settings::get( 'enable_xml_feed' ) ) {
			$endpoints['product_feed_xml'] = home_url( '/agent-shop-feed.xml' );
		}
		if ( AFS_License::can( 'ck' ) ) {
			$endpoints['quote']    = rest_url( $ns . '/quote' );
			$endpoints['checkout'] = rest_url( $ns . '/checkout' );
		}

		$manifest = array(
			'name'        => get_bloginfo( 'name' ),
			'description' => get_bloginfo( 'description' ),
			'url'         => home_url( '/' ),
			'generator'   => 'agent-ready-shop/' . AFS_VERSION,
			'edition'     => AFS_License::is_pro() ? 'pro' : 'free',
			'certificate' => AFS_Certificate::manifest_data(),
			'language'    => get_bloginfo( 'language' ),
			'commerce'    => array(
				'platform' => $has_wc ? 'woocommerce' : 'unknown',
				'currency' => $has_wc ? get_woocommerce_currency() : null,
				'enabled'  => $has_wc,
			),
			'capabilities' => array(
				'browse_products'       => $has_wc,
				'search_products'       => $has_wc,
				'read_inventory'        => $has_wc,
				'read_pricing'          => $has_wc,
				'add_to_cart'           => $has_wc && AFS_License::can( 'ck' ),
				'programmatic_checkout' => $has_wc && AFS_License::can( 'ck' ),
			),
			'endpoints'     => $endpoints,
			'rate_limits'   => AFS_Settings::get( 'enable_rate_limit' ) ? ( new AFS_Rate_Limiter() )->advertised_limits() : null,
			'documentation' => home_url( '/llms.txt' ),
			'policies'      => self::policies(),
			'contact'       => get_option( 'admin_email' ) ? array( 'email' => get_option( 'admin_email' ) ) : null,
		);

		/**
		 * Filter the agent manifest before it is served.
		 *
		 * @param array $manifest The manifest array.
		 */
		return apply_filters( 'afs_manifest', $manifest );
	}

	/**
	 * Resolve known policy page URLs.
	 *
	 * @return array
	 */
	private static function policies() {
		$policies = array(
			'privacy' => function_exists( 'get_privacy_policy_url' ) ? ( get_privacy_policy_url() ?: null ) : null,
		);

		if ( function_exists( 'wc_get_page_id' ) ) {
			$terms_id = (int) get_option( 'woocommerce_terms_page_id' );
			if ( $terms_id > 0 ) {
				$policies['terms'] = get_permalink( $terms_id ) ?: null;
			}
		}

		return array_filter( $policies );
	}

	/**
	 * Build the llms.txt body (follows the llms.txt convention: H1, summary
	 * blockquote, then link sections).
	 *
	 * @return string
	 */
	private function llms_txt() {
		$name  = get_bloginfo( 'name' );
		$desc  = get_bloginfo( 'description' );
		$intro = trim( (string) AFS_Settings::get( 'llms_intro' ) );
		$ns    = AFS_REST_NAMESPACE;

		$lines   = array();
		$lines[] = '# ' . $name;
		$lines[] = '';
		$lines[] = '> ' . ( $desc ? $desc : 'Online shop. Product data is available to AI agents in structured form.' );
		$lines[] = '';
		if ( $intro && AFS_License::can( 'li' ) ) {
			$lines[] = $intro;
		} else {
			$lines[] = 'This store is optimized for AI shopping agents. Product, pricing, and';
			$lines[] = 'availability data is available as JSON. Prefer the API endpoints below over';
			$lines[] = 'scraping HTML.';
		}
		$lines[] = '';
		$lines[] = '## Machine-readable endpoints';
		$lines[] = '';
		$lines[] = sprintf( '- [Agent manifest](%s): capabilities and endpoint index (JSON)', home_url( '/.well-known/agent-shop.json' ) );
		$lines[] = sprintf( '- [OpenAPI spec](%s): formal API description', rest_url( $ns . '/openapi.json' ) );
		$lines[] = sprintf( '- [Product feed](%s): all products with price, stock, SKU, GTIN', rest_url( $ns . '/products' ) );
		$lines[] = sprintf( '- [Product search](%s): full-text search', add_query_arg( 'search', 'QUERY', rest_url( $ns . '/products' ) ) );
		$lines[] = sprintf( '- [Categories](%s): product taxonomy', rest_url( $ns . '/categories' ) );
		if ( AFS_Settings::get( 'enable_xml_feed' ) ) {
			$lines[] = sprintf( '- [Google product feed](%s): RSS 2.0 / Merchant format', home_url( '/agent-shop-feed.xml' ) );
		}
		$lines[] = '';

		if ( function_exists( 'wc_get_products' ) ) {
			$lines[] = '## Cart & checkout';
			$lines[] = '';
			$lines[] = sprintf( '- [Cart API](%s): WooCommerce Store API (add/update/remove items)', rest_url( 'wc/store/v1/cart' ) );
			$lines[] = sprintf( '- [Checkout API](%s): WooCommerce Store API checkout', rest_url( 'wc/store/v1/checkout' ) );
			$lines[] = '';
		}

		$policies = self::policies();
		if ( $policies ) {
			$lines[] = '## Policies';
			$lines[] = '';
			foreach ( $policies as $label => $url ) {
				$lines[] = sprintf( '- [%s policy](%s)', ucfirst( $label ), $url );
			}
			$lines[] = '';
		}

		$lines[] = '## Notes';
		$lines[] = '';
		$lines[] = '- Prices include the store currency in each product object.';
		$lines[] = '- Availability values map to schema.org: InStock, OutOfStock, OnBackOrder.';
		$lines[] = '- Respect robots.txt and rate limits. Identify your agent in the User-Agent header.';
		$lines[] = '';

		// Free-edition promo line (removed by the "li" premium feature).
		if ( ! AFS_License::can( 'li' ) ) {
			$lines[] = '---';
			$lines[] = 'Generated by Agent Ready Shop (free edition).';
			$lines[] = '';
		}

		return implode( "\n", $lines ) . "\n";
	}

	/**
	 * Build a Google Merchant-style RSS 2.0 product feed.
	 *
	 * @return string
	 */
	private function xml_feed() {
		$max = (int) AFS_Settings::get( 'feed_max_items' );

		// Free edition: hard-cap the feed length.
		if ( ! AFS_License::can( 'xf' ) ) {
			$max = min( $max, 20 );
		}

		$xml  = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
		if ( ! AFS_License::can( 'xf' ) ) {
			$xml .= '<!-- Free edition: limited to ' . (int) $max . ' items. Enter a Pro license for the full feed. -->' . "\n";
		}
		$xml .= '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">' . "\n";
		$xml .= "  <channel>\n";
		$xml .= '    <title>' . esc_html( get_bloginfo( 'name' ) ) . "</title>\n";
		$xml .= '    <link>' . esc_url( home_url( '/' ) ) . "</link>\n";
		$xml .= '    <description>' . esc_html( get_bloginfo( 'description' ) ) . "</description>\n";

		if ( function_exists( 'wc_get_products' ) ) {
			$products = wc_get_products( array(
				'status' => 'publish',
				'limit'  => $max,
				'return' => 'objects',
			) );
			$currency = get_woocommerce_currency();

			foreach ( $products as $product ) {
				if ( ! $product->is_visible() ) {
					continue;
				}
				$price = $product->get_price();
				if ( '' === $price ) {
					continue;
				}
				$image        = wp_get_attachment_image_url( $product->get_image_id(), 'full' );
				$availability = $product->is_in_stock() ? 'in_stock' : 'out_of_stock';
				if ( 'onbackorder' === $product->get_stock_status() ) {
					$availability = 'backorder';
				}

				$xml .= "    <item>\n";
				$xml .= '      <g:id>' . esc_html( $product->get_sku() ?: (string) $product->get_id() ) . "</g:id>\n";
				$xml .= '      <g:title>' . esc_html( $product->get_name() ) . "</g:title>\n";
				$xml .= '      <g:description>' . esc_html( wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ) ) . "</g:description>\n";
				$xml .= '      <g:link>' . esc_url( get_permalink( $product->get_id() ) ) . "</g:link>\n";
				if ( $image ) {
					$xml .= '      <g:image_link>' . esc_url( $image ) . "</g:image_link>\n";
				}
				$xml .= '      <g:availability>' . esc_html( $availability ) . "</g:availability>\n";
				$xml .= '      <g:price>' . esc_html( wc_format_decimal( $price, 2 ) . ' ' . $currency ) . "</g:price>\n";
				$xml .= "      <g:condition>new</g:condition>\n";
				if ( method_exists( $product, 'get_global_unique_id' ) && $product->get_global_unique_id() ) {
					$xml .= '      <g:gtin>' . esc_html( $product->get_global_unique_id() ) . "</g:gtin>\n";
				}
				$xml .= "    </item>\n";
			}
		}

		$xml .= "  </channel>\n</rss>\n";
		return $xml;
	}

	/**
	 * Append discovery hints and explicit AI-crawler permissions to robots.txt.
	 *
	 * NOTE: This only applies when no physical robots.txt file exists.
	 *
	 * @param string $output Existing robots.txt output.
	 * @param bool   $public Whether the site is public.
	 * @return string
	 */
	public function robots_txt( $output, $public ) {
		if ( ! $public ) {
			return $output;
		}

		$ns      = AFS_REST_NAMESPACE;
		$output .= "\n# --- Agent Ready Shop ---\n";
		$output .= '# Machine-readable manifest: ' . home_url( '/.well-known/agent-shop.json' ) . "\n";
		$output .= '# LLM guide: ' . home_url( '/llms.txt' ) . "\n";
		$output .= '# Product feed: ' . rest_url( $ns . '/products' ) . "\n";

		$block_training = (bool) AFS_Settings::get( 'block_training_bots' );
		$training       = self::training_bots();

		$agents = apply_filters( 'afs_allowed_agents', $this->effective_agents() );
		foreach ( $agents as $agent ) {
			if ( $block_training && in_array( $agent, $training, true ) ) {
				continue; // handled in the block section below.
			}
			$output .= "\nUser-agent: " . $agent . "\nAllow: /\n";
		}

		// Explicitly disallow AI *training* crawlers while still welcoming shopping agents.
		if ( $block_training ) {
			$output .= "\n# Blocked: AI training crawlers (allow shopping agents, deny model training)\n";
			foreach ( $training as $bot ) {
				$output .= "\nUser-agent: " . $bot . "\nDisallow: /\n";
			}
		}

		return $output;
	}

	/**
	 * Crawlers used primarily for LLM training / dataset collection.
	 *
	 * @return string[]
	 */
	public static function training_bots() {
		return apply_filters( 'afs_training_bots', array( 'CCBot', 'Google-Extended', 'Applebot-Extended', 'Bytespider', 'Amazonbot', 'anthropic-ai', 'Meta-ExternalAgent' ) );
	}

	/**
	 * The agent list after applying license limits.
	 *
	 * Free edition: no wildcard, capped at 5 agents.
	 *
	 * @return string[]
	 */
	private function effective_agents() {
		$agents = AFS_Settings::allowed_agents();

		if ( ! AFS_License::can( 'wc' ) ) {
			$agents = array_values( array_filter( $agents, function ( $a ) {
				return '*' !== $a;
			} ) );
			$agents = array_slice( $agents, 0, 5 );
		}

		return $agents;
	}
}
