<?php
/**
 * Schema.org JSON-LD structured data + <head> discovery links.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Structured_Data {

	/**
	 * Register hooks.
	 */
	public function hooks() {
		add_action( 'wp_head', array( $this, 'head_links' ), 1 );

		if ( AFS_Settings::get( 'enable_json_ld' ) ) {
			add_action( 'wp_head', array( $this, 'product_json_ld' ), 20 );
		}

		// Optionally suppress WooCommerce's own Product schema to avoid duplicates.
		if ( AFS_Settings::get( 'disable_wc_schema' ) ) {
			add_filter( 'woocommerce_structured_data_product', '__return_empty_array', 99 );
		}
	}

	/**
	 * Emit discovery <link>/<meta> tags on every page so agents that render
	 * HTML can still find the machine-readable surfaces.
	 */
	public function head_links() {
		$ns = AFS_REST_NAMESPACE;

		printf(
			'<link rel="alternate" type="application/json" title="Agent product feed" href="%s" />' . "\n",
			esc_url( rest_url( $ns . '/products' ) )
		);
		printf(
			'<link rel="manifest" type="application/json" title="Agent manifest" href="%s" />' . "\n",
			esc_url( home_url( '/.well-known/agent-shop.json' ) )
		);
		printf(
			'<link rel="alternate" type="text/plain" title="llms.txt" href="%s" />' . "\n",
			esc_url( home_url( '/llms.txt' ) )
		);
		printf( '<meta name="ai-agent-api" content="%s" />' . "\n", esc_url( rest_url( $ns . '/manifest' ) ) );
	}

	/**
	 * Output Product JSON-LD on single product pages.
	 *
	 * WooCommerce ships its own product structured data; if you rely on this
	 * one, disable the native output to avoid duplicates (see readme / issues).
	 */
	public function product_json_ld() {
		if ( ! function_exists( 'is_product' ) || ! is_product() ) {
			return;
		}

		global $product;
		if ( ! $product instanceof WC_Product ) {
			$product = wc_get_product( get_the_ID() );
		}
		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$availability = 'https://schema.org/' . $this->availability( $product );

		$offers = array(
			'@type'         => 'Offer',
			'url'           => get_permalink( $product->get_id() ),
			'priceCurrency' => get_woocommerce_currency(),
			'price'         => wc_get_price_to_display( $product ),
			'availability'  => $availability,
			'itemCondition' => 'https://schema.org/NewCondition',
		);

		// PREMIUM: enrich offers with the merchant conditions agents compare on.
		if ( AFS_License::is_pro() ) {
			$offers['hasMerchantReturnPolicy'] = array(
				'@type'                => 'MerchantReturnPolicy',
				'applicableCountry'    => WC()->countries ? WC()->countries->get_base_country() : 'US',
				'returnPolicyCategory' => 'https://schema.org/MerchantReturnFiniteReturnWindow',
				'merchantReturnDays'   => (int) apply_filters( 'afs_return_days', 14 ),
				'returnMethod'         => 'https://schema.org/ReturnByMail',
				'returnFees'           => 'https://schema.org/FreeReturn',
			);
			$offers['shippingDetails'] = array(
				'@type'          => 'OfferShippingDetails',
				'shippingRate'   => array(
					'@type'    => 'MonetaryAmount',
					'value'    => (float) apply_filters( 'afs_shipping_rate', 0 ),
					'currency' => get_woocommerce_currency(),
				),
				'deliveryTime'   => array(
					'@type'               => 'ShippingDeliveryTime',
					'handlingTime'        => array( '@type' => 'QuantitativeValue', 'minValue' => 0, 'maxValue' => 1, 'unitCode' => 'DAY' ),
					'transitTime'         => array( '@type' => 'QuantitativeValue', 'minValue' => 1, 'maxValue' => 5, 'unitCode' => 'DAY' ),
				),
			);
		}

		$schema = array(
			'@context'    => 'https://schema.org/',
			'@type'       => 'Product',
			'name'        => $product->get_name(),
			'description' => wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ),
			'sku'         => $product->get_sku(),
			'url'         => get_permalink( $product->get_id() ),
			'offers'      => $offers,
		);

		if ( method_exists( $product, 'get_global_unique_id' ) && $product->get_global_unique_id() ) {
			$schema['gtin'] = $product->get_global_unique_id();
		}

		$image = wp_get_attachment_image_url( $product->get_image_id(), 'full' );
		if ( $image ) {
			$schema['image'] = $image;
		}

		if ( $product->get_review_count() > 0 ) {
			$schema['aggregateRating'] = array(
				'@type'       => 'AggregateRating',
				'ratingValue' => $product->get_average_rating(),
				'reviewCount' => $product->get_review_count(),
			);
		}

		echo "\n" . '<script type="application/ld+json">' . wp_json_encode( $schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) . '</script>' . "\n";
	}

	/**
	 * WC stock status -> schema.org availability leaf.
	 *
	 * @param WC_Product $product Product.
	 * @return string
	 */
	private function availability( $product ) {
		switch ( $product->get_stock_status() ) {
			case 'instock':
				return 'InStock';
			case 'onbackorder':
				return 'BackOrder';
			default:
				return 'OutOfStock';
		}
	}
}
