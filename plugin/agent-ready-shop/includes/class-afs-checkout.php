<?php
/**
 * PREMIUM: Agentic checkout.
 *
 * Lets AI agents price a basket and create a ready-to-pay order via REST,
 * without scraping the cart UI. This is the flagship paid capability: the free
 * edition makes a store *readable*; Pro makes it *transactable*.
 *
 * Endpoints (both gated on the "ck" license feature):
 *   POST agent-shop/v1/quote     { items:[{id|sku, quantity}] }
 *   POST agent-shop/v1/checkout  { items:[...], email? }  -> pending order + pay URL
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

	/**
	 * Gate + prerequisites shared by both endpoints.
	 *
	 * @return WP_Error|null
	 */
	private function guard() {
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
		// Light abuse throttle: 30 order/quote calls per IP per 10 min.
		$ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0';
		$key = 'afs_ck_' . md5( $ip );
		$n   = (int) get_transient( $key );
		if ( $n > 30 ) {
			return new WP_Error( 'afs_rate_limited', 'Too many requests. Try again shortly.', array( 'status' => 429 ) );
		}
		set_transient( $key, $n + 1, 10 * MINUTE_IN_SECONDS );
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

		$resolved = array();
		foreach ( $items as $item ) {
			$qty = max( 1, (int) ( $item['quantity'] ?? 1 ) );
			$product = null;
			if ( ! empty( $item['id'] ) ) {
				$product = wc_get_product( (int) $item['id'] );
			} elseif ( ! empty( $item['sku'] ) ) {
				$product = wc_get_product( wc_get_product_id_by_sku( sanitize_text_field( $item['sku'] ) ) );
			}
			if ( ! $product || 'publish' !== $product->get_status() ) {
				return new WP_Error( 'afs_item_not_found', 'Product not found: ' . wp_json_encode( $item ), array( 'status' => 404 ) );
			}
			if ( ! $product->is_purchasable() || ! $product->is_in_stock() ) {
				return new WP_Error( 'afs_not_purchasable', $product->get_name() . ' is not purchasable.', array( 'status' => 409 ) );
			}
			$resolved[] = array( $product, $qty );
		}
		return $resolved;
	}

	/**
	 * POST /quote — price a basket without creating an order.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function quote( WP_REST_Request $request ) {
		$gate = $this->guard();
		if ( $gate ) {
			return $gate;
		}
		$items = $this->resolve_items( $request );
		if ( is_wp_error( $items ) ) {
			return $items;
		}

		$lines = array();
		$total = 0.0;
		foreach ( $items as list( $product, $qty ) ) {
			$price  = (float) wc_get_price_to_display( $product );
			$total += $price * $qty;
			$lines[] = array(
				'id'         => $product->get_id(),
				'name'       => $product->get_name(),
				'quantity'   => $qty,
				'unit_price' => $price,
				'line_total' => round( $price * $qty, 2 ),
			);
		}

		return rest_ensure_response( array(
			'currency' => get_woocommerce_currency(),
			'items'    => $lines,
			'total'    => round( $total, 2 ),
		) );
	}

	/**
	 * POST /checkout — create a pending order and return a pay URL.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function checkout( WP_REST_Request $request ) {
		$gate = $this->guard();
		if ( $gate ) {
			return $gate;
		}
		$items = $this->resolve_items( $request );
		if ( is_wp_error( $items ) ) {
			return $items;
		}

		$order = wc_create_order();
		if ( is_wp_error( $order ) ) {
			return $order;
		}

		foreach ( $items as list( $product, $qty ) ) {
			$order->add_product( $product, $qty );
		}

		$email = sanitize_email( (string) $request->get_param( 'email' ) );
		if ( $email ) {
			$order->set_billing_email( $email );
		}
		$order->add_order_note( 'Created via Agent Ready Shop agentic checkout.' );
		$order->calculate_totals();
		$order->update_status( 'pending', 'Awaiting agent-directed payment.' );

		return rest_ensure_response( array(
			'success'   => true,
			'order_id'  => $order->get_id(),
			'currency'  => get_woocommerce_currency(),
			'total'     => (float) $order->get_total(),
			'status'    => $order->get_status(),
			'pay_url'   => $order->get_checkout_payment_url(),
			'message'   => 'Pending order created. Direct the shopper to pay_url to complete the purchase.',
		) );
	}
}
