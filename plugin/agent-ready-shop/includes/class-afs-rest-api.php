<?php
/**
 * Clean, normalized REST API designed for agent consumption.
 *
 * Namespace: agent-shop/v1
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_REST_API {

	/**
	 * Register hooks.
	 */
	public function hooks() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );

		// Bust the feed cache whenever the catalog changes.
		add_action( 'woocommerce_update_product', array( $this, 'bump_cache' ) );
		add_action( 'woocommerce_new_product', array( $this, 'bump_cache' ) );
		add_action( 'woocommerce_product_set_stock', array( $this, 'bump_cache' ) );
		add_action( 'save_post_product', array( $this, 'bump_cache' ) );
	}

	/**
	 * Increment the cache version, invalidating all cached feed responses.
	 */
	public function bump_cache() {
		update_option( 'afs_cache_version', (int) get_option( 'afs_cache_version', 1 ) + 1, false );
	}

	/**
	 * Register all agent-shop routes.
	 */
	public function register_routes() {
		$ns = AFS_REST_NAMESPACE;

		register_rest_route( $ns, '/manifest', array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => '__return_true',
			'callback'            => array( $this, 'get_manifest' ),
		) );

		register_rest_route( $ns, '/openapi.json', array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => '__return_true',
			'callback'            => array( $this, 'get_openapi' ),
		) );

		register_rest_route( $ns, '/products', array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => '__return_true',
			'callback'            => array( $this, 'get_products' ),
			'args'                => array(
				'search'   => array( 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ),
				'category' => array( 'type' => 'string', 'sanitize_callback' => 'sanitize_title' ),
				'in_stock' => array( 'type' => 'boolean' ),
				'min_price' => array( 'type' => 'number' ),
				'max_price' => array( 'type' => 'number' ),
				'per_page' => array( 'type' => 'integer', 'default' => 20, 'minimum' => 1, 'maximum' => 100 ),
				'page'     => array( 'type' => 'integer', 'default' => 1, 'minimum' => 1 ),
				'orderby'  => array( 'type' => 'string', 'enum' => array( 'date', 'price', 'popularity', 'rating', 'title' ), 'default' => 'date' ),
				'order'    => array( 'type' => 'string', 'enum' => array( 'asc', 'desc' ), 'default' => 'desc' ),
			),
		) );

		register_rest_route( $ns, '/products/(?P<id>\d+)', array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => '__return_true',
			'callback'            => array( $this, 'get_product' ),
			'args'                => array(
				'id' => array( 'type' => 'integer', 'required' => true ),
			),
		) );

		register_rest_route( $ns, '/categories', array(
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => '__return_true',
			'callback'            => array( $this, 'get_categories' ),
		) );
	}

	/**
	 * GET /manifest
	 */
	public function get_manifest() {
		return rest_ensure_response( AFS_Discovery::get_manifest() );
	}

	/**
	 * GET /products
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_products( WP_REST_Request $request ) {
		if ( ! function_exists( 'wc_get_products' ) ) {
			return $this->no_woocommerce();
		}

		// Serve from cache when enabled.
		$ttl       = (int) AFS_Settings::get( 'cache_ttl' );
		$cache_key = 'afs_feed_' . get_option( 'afs_cache_version', 1 ) . '_' . md5( wp_json_encode( $request->get_params() ) );
		if ( $ttl > 0 ) {
			$cached = get_transient( $cache_key );
			if ( is_array( $cached ) ) {
				$response = rest_ensure_response( $cached );
				$response->header( 'X-AFS-Cache', 'HIT' );
				return $response;
			}
		}

		// Free edition: cap page size (Pro "fc" feature raises it to 100).
		$per_page = (int) $request['per_page'];
		if ( ! AFS_License::can( 'fc' ) ) {
			$per_page = min( $per_page, 20 );
		}

		$args = array(
			'status'   => 'publish',
			'limit'    => $per_page,
			'page'     => $request['page'],
			'paginate' => true,
			'orderby'  => $request['orderby'],
			'order'    => strtoupper( $request['order'] ),
		);

		if ( ! empty( $request['search'] ) ) {
			$args['s'] = $request['search'];
		}
		if ( ! empty( $request['category'] ) ) {
			$args['category'] = array( $request['category'] );
		}
		if ( null !== $request['in_stock'] && $request->has_param( 'in_stock' ) ) {
			$args['stock_status'] = $request['in_stock'] ? 'instock' : 'outofstock';
		}

		$results  = wc_get_products( $args );
		$products = array();
		foreach ( $results->products as $product ) {
			$normalized = $this->normalize_product( $product );

			// Post-filter on price if requested (kept simple/portable).
			$price = $normalized['price'];
			if ( null !== $request['min_price'] && ( null === $price || $price < (float) $request['min_price'] ) ) {
				continue;
			}
			if ( null !== $request['max_price'] && ( null === $price || $price > (float) $request['max_price'] ) ) {
				continue;
			}

			$products[] = $normalized;
		}

		$payload = array(
			'currency' => get_woocommerce_currency(),
			'total'    => (int) $results->total,
			'pages'    => (int) $results->max_num_pages,
			'page'     => (int) $request['page'],
			'products' => $products,
		);

		if ( $ttl > 0 ) {
			set_transient( $cache_key, $payload, $ttl );
		}

		$response = rest_ensure_response( $payload );
		$response->header( 'X-WP-Total', (int) $results->total );
		$response->header( 'X-WP-TotalPages', (int) $results->max_num_pages );
		$response->header( 'X-AFS-Cache', $ttl > 0 ? 'MISS' : 'OFF' );
		$response->header( 'X-AFS-Edition', AFS_License::is_pro() ? 'pro' : 'free' );

		return $response;
	}

	/**
	 * GET /products/{id}
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_product( WP_REST_Request $request ) {
		if ( ! function_exists( 'wc_get_product' ) ) {
			return $this->no_woocommerce();
		}

		$product = wc_get_product( (int) $request['id'] );
		if ( ! $product || 'publish' !== $product->get_status() ) {
			return new WP_Error( 'afs_not_found', 'Product not found.', array( 'status' => 404 ) );
		}

		return rest_ensure_response( $this->normalize_product( $product, true ) );
	}

	/**
	 * GET /categories
	 */
	public function get_categories() {
		if ( ! taxonomy_exists( 'product_cat' ) ) {
			return $this->no_woocommerce();
		}

		$terms = get_terms( array(
			'taxonomy'   => 'product_cat',
			'hide_empty' => true,
		) );

		$categories = array();
		if ( ! is_wp_error( $terms ) ) {
			foreach ( $terms as $term ) {
				$categories[] = array(
					'id'          => $term->term_id,
					'name'        => $term->name,
					'slug'        => $term->slug,
					'count'       => (int) $term->count,
					'parent'      => $term->parent ? (int) $term->parent : null,
					'url'         => get_term_link( $term ),
					'feed'        => add_query_arg( 'category', $term->slug, rest_url( AFS_REST_NAMESPACE . '/products' ) ),
					'description' => wp_strip_all_tags( $term->description ),
				);
			}
		}

		return rest_ensure_response( array( 'categories' => $categories ) );
	}

	/**
	 * Convert a WC_Product into a flat, agent-friendly object.
	 *
	 * @param WC_Product $product Product.
	 * @param bool       $full    Include heavy fields (variations, full description).
	 * @return array
	 */
	private function normalize_product( $product, $full = false ) {
		$id = $product->get_id();

		$images = array();
		$image_ids = array_filter( array_merge( array( $product->get_image_id() ), $product->get_gallery_image_ids() ) );
		foreach ( array_unique( $image_ids ) as $image_id ) {
			$src = wp_get_attachment_image_url( $image_id, 'full' );
			if ( $src ) {
				$images[] = $src;
			}
		}

		$attributes = array();
		foreach ( $product->get_attributes() as $attribute ) {
			if ( ! is_object( $attribute ) ) {
				continue;
			}
			$name   = wc_attribute_label( $attribute->get_name() );
			$values = $attribute->is_taxonomy()
				? wc_get_product_terms( $id, $attribute->get_name(), array( 'fields' => 'names' ) )
				: $attribute->get_options();
			$attributes[ $name ] = array_values( $values );
		}

		$price = $product->get_price();

		$data = array(
			'id'              => $id,
			'type'            => $product->get_type(),
			'sku'             => $product->get_sku() ?: null,
			'gtin'            => method_exists( $product, 'get_global_unique_id' ) ? ( $product->get_global_unique_id() ?: null ) : null,
			'name'            => $product->get_name(),
			'slug'            => $product->get_slug(),
			'url'             => get_permalink( $id ),
			'currency'        => get_woocommerce_currency(),
			'price'           => ( '' !== $price ) ? (float) $price : null,
			'regular_price'   => ( '' !== $product->get_regular_price() ) ? (float) $product->get_regular_price() : null,
			'sale_price'      => ( '' !== $product->get_sale_price() ) ? (float) $product->get_sale_price() : null,
			'on_sale'         => $product->is_on_sale(),
			'in_stock'        => $product->is_in_stock(),
			'availability'    => $this->schema_availability( $product ),
			'stock_quantity'  => $product->get_stock_quantity(),
			'short_description' => wp_strip_all_tags( $product->get_short_description() ),
			'categories'      => wp_get_post_terms( $id, 'product_cat', array( 'fields' => 'names' ) ),
			'images'          => $images,
			'attributes'      => $attributes,
			'rating'          => (float) $product->get_average_rating() ?: null,
			'review_count'    => (int) $product->get_review_count(),
			'add_to_cart_url' => method_exists( $product, 'add_to_cart_url' ) ? $product->add_to_cart_url() : get_permalink( $id ),
			'purchasable'     => $product->is_purchasable(),
		);

		if ( $full ) {
			$data['description'] = wp_strip_all_tags( $product->get_description() );
			$data['weight']     = $product->get_weight() ?: null;
			$data['dimensions'] = array(
				'length' => $product->get_length() ?: null,
				'width'  => $product->get_width() ?: null,
				'height' => $product->get_height() ?: null,
			);

			// Variations for variable products.
			if ( $product->is_type( 'variable' ) ) {
				$variations = array();
				foreach ( $product->get_available_variations() as $variation ) {
					$variations[] = array(
						'id'           => $variation['variation_id'],
						'sku'          => $variation['sku'] ?: null,
						'price'        => isset( $variation['display_price'] ) ? (float) $variation['display_price'] : null,
						'in_stock'     => (bool) $variation['is_in_stock'],
						'attributes'   => $variation['attributes'],
					);
				}
				$data['variations'] = $variations;
			}
		}

		return $data;
	}

	/**
	 * Map WooCommerce stock status to a schema.org ItemAvailability value.
	 *
	 * @param WC_Product $product Product.
	 * @return string
	 */
	private function schema_availability( $product ) {
		switch ( $product->get_stock_status() ) {
			case 'instock':
				return 'InStock';
			case 'onbackorder':
				return 'OnBackOrder';
			default:
				return 'OutOfStock';
		}
	}

	/**
	 * Standard error when WooCommerce is inactive.
	 *
	 * @return WP_Error
	 */
	private function no_woocommerce() {
		return new WP_Error(
			'afs_no_woocommerce',
			'WooCommerce is not active on this site, so no product data is available.',
			array( 'status' => 501 )
		);
	}

	/**
	 * GET /openapi.json — a minimal OpenAPI 3.1 description for tool discovery.
	 *
	 * @return WP_REST_Response
	 */
	public function get_openapi() {
		$base = rest_url( AFS_REST_NAMESPACE );

		$product_schema = array(
			'type'       => 'object',
			'properties' => array(
				'id'           => array( 'type' => 'integer' ),
				'sku'          => array( 'type' => array( 'string', 'null' ) ),
				'gtin'         => array( 'type' => array( 'string', 'null' ) ),
				'name'         => array( 'type' => 'string' ),
				'url'          => array( 'type' => 'string', 'format' => 'uri' ),
				'currency'     => array( 'type' => 'string' ),
				'price'        => array( 'type' => array( 'number', 'null' ) ),
				'availability' => array( 'type' => 'string', 'enum' => array( 'InStock', 'OutOfStock', 'OnBackOrder' ) ),
				'images'       => array( 'type' => 'array', 'items' => array( 'type' => 'string', 'format' => 'uri' ) ),
			),
		);

		$spec = array(
			'openapi' => '3.1.0',
			'info'    => array(
				'title'       => get_bloginfo( 'name' ) . ' — Agent Shop API',
				'description' => 'Machine-readable catalog for AI shopping agents.',
				'version'     => AFS_VERSION,
			),
			'servers' => array( array( 'url' => $base ) ),
			'paths'   => array(
				'/products' => array(
					'get' => array(
						'operationId' => 'listProducts',
						'summary'     => 'List and search products.',
						'parameters'  => array(
							array( 'name' => 'search', 'in' => 'query', 'schema' => array( 'type' => 'string' ) ),
							array( 'name' => 'category', 'in' => 'query', 'schema' => array( 'type' => 'string' ) ),
							array( 'name' => 'in_stock', 'in' => 'query', 'schema' => array( 'type' => 'boolean' ) ),
							array( 'name' => 'min_price', 'in' => 'query', 'schema' => array( 'type' => 'number' ) ),
							array( 'name' => 'max_price', 'in' => 'query', 'schema' => array( 'type' => 'number' ) ),
							array( 'name' => 'per_page', 'in' => 'query', 'schema' => array( 'type' => 'integer' ) ),
							array( 'name' => 'page', 'in' => 'query', 'schema' => array( 'type' => 'integer' ) ),
						),
						'responses'   => array( '200' => array( 'description' => 'A page of products.' ) ),
					),
				),
				'/products/{id}' => array(
					'get' => array(
						'operationId' => 'getProduct',
						'summary'     => 'Get a single product by ID.',
						'parameters'  => array(
							array( 'name' => 'id', 'in' => 'path', 'required' => true, 'schema' => array( 'type' => 'integer' ) ),
						),
						'responses'   => array(
							'200' => array( 'description' => 'A product.', 'content' => array( 'application/json' => array( 'schema' => array( '$ref' => '#/components/schemas/Product' ) ) ) ),
							'404' => array( 'description' => 'Not found.' ),
						),
					),
				),
				'/categories' => array(
					'get' => array( 'operationId' => 'listCategories', 'summary' => 'List product categories.', 'responses' => array( '200' => array( 'description' => 'Categories.' ) ) ),
				),
			),
			'components' => array( 'schemas' => array( 'Product' => $product_schema ) ),
		);

		return rest_ensure_response( $spec );
	}
}
