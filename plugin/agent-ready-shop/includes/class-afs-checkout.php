<?php
/**
 * PREMIUM: Agentic checkout.
 *
 * Lets AI agents price a basket and create a ready-to-pay order via REST,
 * without scraping the cart UI. This is the flagship paid capability: the free
 * edition makes a store *readable*; Pro makes it *transactable*.
 *
 * Endpoints (both gated on the "ck" license feature):
 *   POST agent-shop/v1/quote     { items:[{id|sku, quantity}], shipping?:{country,postcode,…} }
 *   POST agent-shop/v1/checkout  { items:[...], email, billing?, shipping?, shipping_method? }
 *                                -> pending order + pay URL
 *
 * Variable products must be ordered by VARIATION id. Quantities are checked
 * against stock and purchase limits. Orders are created unpaid ("pending"), so
 * creating them is throttled per client and capped per hour for the whole store.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_Checkout {

	/**
	 * Register hooks.
	 */
	public function hooks() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register the checkout routes (always registered; license is checked in
	 * the callback so unlicensed agents get a clear 402 signal).
	 */
	public function register_routes() {
		$ns   = AFS_REST_NAMESPACE;
		$args = array(
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
		);
		register_rest_route( $ns, '/quote', $args + array( 'callback' => array( $this, 'quote' ) ) );
		register_rest_route( $ns, '/checkout', $args + array( 'callback' => array( $this, 'checkout' ) ) );
	}

	/** Max line items per request and max units per line. */
	const MAX_LINES = 50;
	const MAX_QTY   = 999;

	/**
	 * Client address used for throttling. Behind a reverse proxy or CDN,
	 * REMOTE_ADDR is the proxy; use the `afs_client_ip` filter to supply the
	 * real address from the header YOUR proxy sets (never trust such a header
	 * blindly).
	 *
	 * @return string
	 */
	private function client_ip() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0';
		return (string) apply_filters( 'afs_client_ip', $ip );
	}

	/**
	 * Count a hit against a fixed-window limit. Returns false when exhausted.
	 *
	 * @param string $key    Counter name.
	 * @param int    $limit  Allowed hits per window.
	 * @param int    $window Window length in seconds.
	 * @return bool
	 */
	private function allow( $key, $limit, $window ) {
		$key  = 'afs_ck_' . md5( $key );
		$data = get_transient( $key );
		$now  = time();
		if ( ! is_array( $data ) || $data['until'] <= $now ) {
			$data = array( 'n' => 0, 'until' => $now + $window );
		}
		if ( $data['n'] >= $limit ) {
			return false;
		}
		$data['n']++;
		set_transient( $key, $data, max( 1, $data['until'] - $now ) );
		return true;
	}

	/**
	 * Gate + prerequisites shared by both endpoints.
	 *
	 * @param bool $creates_order Whether the call will create an order.
	 * @return WP_Error|null
	 */
	private function guard( $creates_order ) {
		if ( ! AFS_License::can( 'ck' ) ) {
			return new WP_Error(
				'afs_premium_required',
				'Agentic checkout is an Agent Ready Shop Pro feature. Ask the merchant to enable it.',
				array( 'status' => 402 )
			);
		}
		if ( ! function_exists( 'wc_get_product' ) ) {
			return new WP_Error( 'afs_no_woocommerce', 'WooCommerce is not active.', array( 'status' => 501 ) );
		}

		$limited = new WP_Error( 'afs_rate_limited', 'Too many requests. Try again shortly.', array( 'status' => 429 ) );
		$ip      = $this->client_ip();
		if ( ! $creates_order ) {
			return $this->allow( 'q_' . $ip, (int) apply_filters( 'afs_quote_limit', 60 ), 10 * MINUTE_IN_SECONDS ) ? null : $limited;
		}
		// Unpaid orders are cheap to create and costly to clean up: throttle each
		// client hard and cap the whole store, so a proxy-wide shared IP or a
		// rotating one cannot flood the order list.
		if ( ! $this->allow( 'o_' . $ip, (int) apply_filters( 'afs_checkout_limit', 10 ), 10 * MINUTE_IN_SECONDS ) ) {
			return $limited;
		}
		if ( ! $this->allow( 'o_all', (int) apply_filters( 'afs_checkout_hourly_cap', 60 ), HOUR_IN_SECONDS ) ) {
			return $limited;
		}
		return null;
	}

	/**
	 * Resolve and validate the requested line items.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return array|WP_Error  [ [product, qty], ... ]
	 */
	private function resolve_items( WP_REST_Request $request ) {
		$items = $request->get_param( 'items' );
		if ( empty( $items ) || ! is_array( $items ) ) {
			return new WP_Error( 'afs_bad_request', 'Provide items: [{ id or sku, quantity }].', array( 'status' => 400 ) );
		}
		if ( count( $items ) > self::MAX_LINES ) {
			return new WP_Error( 'afs_too_many_items', 'At most ' . self::MAX_LINES . ' line items per request.', array( 'status' => 400 ) );
		}

		// Merge repeated lines first so limits apply to the total per product.
		$wanted = array();
		foreach ( $items as $item ) {
			if ( ! is_array( $item ) ) {
				return new WP_Error( 'afs_bad_request', 'Each item must be an object: { id or sku, quantity }.', array( 'status' => 400 ) );
			}
			$qty = isset( $item['quantity'] ) ? (int) $item['quantity'] : 1;
			if ( $qty < 1 || $qty > self::MAX_QTY ) {
				return new WP_Error( 'afs_bad_quantity', 'Quantity must be between 1 and ' . self::MAX_QTY . '.', array( 'status' => 400 ) );
			}
			$id = 0;
			if ( ! empty( $item['id'] ) ) {
				$id = absint( $item['id'] );
			} elseif ( ! empty( $item['sku'] ) && is_scalar( $item['sku'] ) ) {
				$id = (int) wc_get_product_id_by_sku( sanitize_text_field( (string) $item['sku'] ) );
			}
			if ( ! $id ) {
				return new WP_Error( 'afs_item_not_found', 'Product not found: ' . wp_json_encode( $item ), array( 'status' => 404 ) );
			}
			$wanted[ $id ] = ( $wanted[ $id ] ?? 0 ) + $qty;
		}

		$resolved = array();
		foreach ( $wanted as $id => $qty ) {
			$product = wc_get_product( $id );
			if ( ! $product || 'publish' !== $product->get_status() ) {
				return new WP_Error( 'afs_item_not_found', 'Product not found: ' . $id, array( 'status' => 404 ) );
			}
			if ( $product->is_type( 'variation' ) ) {
				$parent = wc_get_product( $product->get_parent_id() );
				if ( ! $parent || 'publish' !== $parent->get_status() ) {
					return new WP_Error( 'afs_item_not_found', 'Product not found: ' . $id, array( 'status' => 404 ) );
				}
			} elseif ( ! $product->is_type( 'simple' ) ) {
				// Variable, grouped and external products cannot be bought as such.
				return new WP_Error(
					'afs_variation_required',
					$product->get_name() . ' cannot be ordered directly. For a variable product pass the id of one of its variations (see "variations" in GET products/' . $id . ').',
					array( 'status' => 400, 'product_id' => $id, 'type' => $product->get_type() )
				);
			}
			if ( ! $product->is_purchasable() || ! $product->is_in_stock() ) {
				return new WP_Error( 'afs_not_purchasable', $product->get_name() . ' is not purchasable.', array( 'status' => 409 ) );
			}
			$max = (int) $product->get_max_purchase_quantity(); // -1 = unlimited; honours stock, backorders, "sold individually"
			if ( ( $max > -1 && $qty > $max ) || ! $product->has_enough_stock( $qty ) ) {
				return new WP_Error(
					'afs_insufficient_stock',
					$product->get_name() . ': requested ' . $qty . ', available ' . ( $max > -1 ? $max : 0 ) . '.',
					array( 'status' => 409, 'product_id' => $id, 'available' => $max > -1 ? $max : 0 )
				);
			}
			$resolved[] = array( $product, $qty );
		}
		return $resolved;
	}

	/**
	 * Sanitize a postal address object from the request.
	 *
	 * @param mixed $raw Raw value.
	 * @return array
	 */
	private function address( $raw ) {
		$out = array();
		if ( ! is_array( $raw ) ) {
			return $out;
		}
		foreach ( array( 'first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'phone' ) as $field ) {
			if ( isset( $raw[ $field ] ) && is_scalar( $raw[ $field ] ) ) {
				$out[ $field ] = sanitize_text_field( (string) $raw[ $field ] );
			}
		}
		if ( isset( $out['country'] ) ) {
			$out['country'] = strtoupper( substr( $out['country'], 0, 2 ) );
		}
		return $out;
	}

	/**
	 * Do any of the items need to be shipped?
	 *
	 * @param array $items Resolved items.
	 * @return bool
	 */
	private function needs_shipping( array $items ) {
		foreach ( $items as $pair ) {
			if ( $pair[0]->needs_shipping() ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Shipping options for the items to a destination.
	 *
	 * @param array $items Resolved items.
	 * @param array $dest  Sanitized destination address.
	 * @return array|null List of [ id, method_id, instance_id, label, cost ] or null when rates could not be computed.
	 */
	private function shipping_rates( array $items, array $dest ) {
		if ( empty( $dest['country'] ) || ! function_exists( 'WC' ) ) {
			return null;
		}
		try {
			// Some shipping methods read the cart / customer; make sure they exist in REST context.
			if ( null === WC()->cart && function_exists( 'wc_load_cart' ) ) {
				wc_load_cart();
			}
			$contents = array();
			$cost     = 0.0;
			foreach ( $items as $pair ) {
				list( $product, $qty ) = $pair;
				if ( ! $product->needs_shipping() ) {
					continue;
				}
				$line  = (float) wc_get_price_excluding_tax( $product, array( 'qty' => $qty ) );
				$cost += $line;
				$key   = 'afs_' . $product->get_id();
				$contents[ $key ] = array(
					'key'               => $key,
					'product_id'        => $product->is_type( 'variation' ) ? $product->get_parent_id() : $product->get_id(),
					'variation_id'      => $product->is_type( 'variation' ) ? $product->get_id() : 0,
					'variation'         => array(),
					'quantity'          => $qty,
					'data'              => $product,
					'line_total'        => $line,
					'line_tax'          => 0,
					'line_subtotal'     => $line,
					'line_subtotal_tax' => 0,
				);
			}
			if ( ! $contents ) {
				return array();
			}
			$package = WC()->shipping()->calculate_shipping_for_package( array(
				'contents'        => $contents,
				'contents_cost'   => $cost,
				'applied_coupons' => array(),
				'user'            => array( 'ID' => 0 ),
				'destination'     => array(
					'country'   => $dest['country'],
					'state'     => $dest['state'] ?? '',
					'postcode'  => $dest['postcode'] ?? '',
					'city'      => $dest['city'] ?? '',
					'address'   => $dest['address_1'] ?? '',
					'address_1' => $dest['address_1'] ?? '',
					'address_2' => $dest['address_2'] ?? '',
				),
			) );
			$rates = array();
			foreach ( (array) ( $package['rates'] ?? array() ) as $rate ) {
				$rates[] = array(
					'id'          => $rate->get_id(),
					'method_id'   => $rate->get_method_id(),
					'instance_id' => (int) $rate->get_instance_id(),
					'label'       => $rate->get_label(),
					'cost'        => round( (float) $rate->get_cost(), wc_get_price_decimals() ),
				);
			}
			usort( $rates, function ( $a, $b ) {
				return $a['cost'] <=> $b['cost'];
			} );
			return $rates;
		} catch ( \Throwable $e ) {
			return null;
		}
	}

	/**
	 * POST /quote — price a basket without creating an order.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function quote( WP_REST_Request $request ) {
		$gate = $this->guard( false );
		if ( $gate ) {
			return $gate;
		}
		$items = $this->resolve_items( $request );
		if ( is_wp_error( $items ) ) {
			return $items;
		}

		$lines    = array();
		$subtotal = 0.0;
		foreach ( $items as list( $product, $qty ) ) {
			$price     = (float) wc_get_price_to_display( $product );
			$subtotal += $price * $qty;
			$lines[]   = array(
				'id'         => $product->get_id(),
				'name'       => $product->get_name(),
				'quantity'   => $qty,
				'unit_price' => $price,
				'line_total' => round( $price * $qty, 2 ),
			);
		}

		$needs = $this->needs_shipping( $items );
		$dest  = $this->address( $request->get_param( 'shipping' ) );
		$rates = $needs ? $this->shipping_rates( $items, $dest ) : array();

		return rest_ensure_response( array(
			'currency'           => get_woocommerce_currency(),
			'items'              => $lines,
			'subtotal'           => round( $subtotal, 2 ),
			'prices_include_tax' => 'incl' === get_option( 'woocommerce_tax_display_shop' ),
			'needs_shipping'     => $needs,
			'shipping_options'   => $rates,
			// Kept for existing clients: the goods subtotal only.
			'total'              => round( $subtotal, 2 ),
			'total_is_final'     => false,
			'note'               => $needs && null === $rates
				? 'This is the goods subtotal as displayed in the shop. Send shipping: { country, postcode, … } to get shipping options; the binding total including shipping and tax is returned by /checkout.'
				: 'This is the goods subtotal as displayed in the shop. The binding total including the chosen shipping option and tax is returned by /checkout.',
		) );
	}

	/**
	 * POST /checkout — create a pending order and return a pay URL.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function checkout( WP_REST_Request $request ) {
		// Validate everything that needs no order before spending a rate-limit slot.
		if ( ! AFS_License::can( 'ck' ) || ! function_exists( 'wc_get_product' ) ) {
			return $this->guard( true );
		}
		$email = sanitize_email( (string) $request->get_param( 'email' ) );
		if ( ! $email || ! is_email( $email ) ) {
			return new WP_Error( 'afs_email_required', 'Provide the shopper\'s email address: it is where the order confirmation and payment link go.', array( 'status' => 400 ) );
		}
		$items = $this->resolve_items( $request );
		if ( is_wp_error( $items ) ) {
			return $items;
		}

		$shipping = $this->address( $request->get_param( 'shipping' ) );
		$billing  = $this->address( $request->get_param( 'billing' ) );
		$billing  = $billing ? $billing : $shipping;
		$needs    = $this->needs_shipping( $items );
		$rate     = null;
		if ( $needs ) {
			if ( empty( $shipping['country'] ) ) {
				return new WP_Error( 'afs_address_required', 'These items are shipped. Provide shipping: { country, postcode, city, address_1, first_name, last_name }.', array( 'status' => 400 ) );
			}
			$rates = $this->shipping_rates( $items, $shipping );
			if ( is_array( $rates ) && ! $rates ) {
				return new WP_Error( 'afs_no_shipping', 'The store does not ship these items to that address.', array( 'status' => 409 ) );
			}
			if ( $rates ) {
				$want = (string) $request->get_param( 'shipping_method' );
				$rate = $rates[0]; // cheapest
				if ( '' !== $want ) {
					$match = array_values( array_filter( $rates, function ( $r ) use ( $want ) {
						return $r['id'] === $want;
					} ) );
					if ( ! $match ) {
						return new WP_Error( 'afs_bad_shipping_method', 'Unknown shipping_method. Use an id from shipping_options in /quote.', array( 'status' => 400, 'shipping_options' => $rates ) );
					}
					$rate = $match[0];
				}
			}
		}

		$gate = $this->guard( true );
		if ( $gate ) {
			return $gate;
		}

		$order = wc_create_order( array( 'created_via' => 'agent-ready-shop' ) );
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		foreach ( $items as list( $product, $qty ) ) {
			$order->add_product( $product, $qty );
		}
		$order->set_billing_email( $email );
		if ( $billing ) {
			$order->set_address( $billing, 'billing' );
		}
		if ( $shipping ) {
			unset( $shipping['phone'] );
			$order->set_address( $shipping, 'shipping' );
		}
		if ( $rate && class_exists( 'WC_Order_Item_Shipping' ) ) {
			$line = new WC_Order_Item_Shipping();
			$line->set_method_title( $rate['label'] );
			$line->set_method_id( $rate['method_id'] );
			$line->set_instance_id( $rate['instance_id'] );
			$line->set_total( $rate['cost'] );
			$order->add_item( $line );
		}
		$order->add_order_note( 'Created via Agent Ready Shop agentic checkout.' );
		$order->calculate_totals(); // taxes for goods and shipping from the order addresses
		$order->update_status( 'pending', 'Awaiting agent-directed payment.' );

		$shipping_final = ! $needs || null !== $rate;

		return rest_ensure_response( array(
			'success'           => true,
			'order_id'          => $order->get_id(),
			'currency'          => get_woocommerce_currency(),
			'subtotal'          => (float) $order->get_subtotal(),
			'shipping_total'    => (float) $order->get_shipping_total(),
			'shipping_method'   => $rate ? $rate['id'] : null,
			'tax_total'         => (float) $order->get_total_tax(),
			'total'             => (float) $order->get_total(),
			'total_is_final'    => $shipping_final,
			'status'            => $order->get_status(),
			'pay_url'           => $order->get_checkout_payment_url(),
			'message'           => $shipping_final
				? 'Pending order created. Direct the shopper to pay_url to complete the purchase.'
				: 'Pending order created, but shipping could not be calculated automatically: the merchant has to add it before payment.',
		) );
	}
}
