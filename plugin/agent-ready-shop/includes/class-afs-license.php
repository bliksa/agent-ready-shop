<?php
/**
 * Offline license validation (Ed25519, asymmetric).
 *
 * License keys are self-describing tokens that validate entirely offline (no
 * phone-home). A key encodes version, plan, expiry, feature set and a serial,
 * signed with the vendor's Ed25519 PRIVATE key. This plugin ships only the
 * PUBLIC key and verifies the signature via libsodium, so distributing the
 * plugin publicly does not let anyone forge keys.
 *
 * @package AgentReadyShop
 */

defined( 'ABSPATH' ) || exit;

class AFS_License {

	const OPTION_KEY = 'afs_license_key';

	/**
	 * Ed25519 PUBLIC verification key (raw 32 bytes, base64). Safe to ship —
	 * the matching PRIVATE key lives only on the Agent Ready Shop server, so a
	 * public plugin download cannot forge keys. Replace with your own key pair.
	 */
	const PUBLIC_KEY = '2Zell5zWOpfbYWrABOrOte+GLzo96tqtfABcE4/s3Ow=';

	/**
	 * Premium feature codes => human labels.
	 */
	const FEATURES = array(
		'ck' => 'Agentic checkout (cart & order API)',
		'an' => 'Advanced AI analytics & export',
		'xf' => 'Full Google / XML product feed',
		'au' => 'Automatic plugin updates',
		'wc' => 'Unlimited AI agents + wildcard (*)',
		'li' => 'Custom llms.txt intro (no promo line)',
		'fc' => 'Feed controls (large page size, feed size, cache)',
	);

	/**
	 * In-request cache of the validated license.
	 *
	 * @var array|null
	 */
	private static $cache = null;

	/**
	 * The stored (raw) license key.
	 *
	 * @return string
	 */
	public static function key() {
		return trim( (string) get_option( self::OPTION_KEY, '' ) );
	}

	/**
	 * Validated license data for the stored key (cached per request).
	 *
	 * @return array
	 */
	public static function data() {
		if ( null === self::$cache ) {
			self::$cache = self::validate( self::key() );
		}
		return self::$cache;
	}

	/**
	 * Clear the request cache (after the key changes).
	 */
	public static function flush() {
		self::$cache = null;
	}

	/**
	 * Is there a currently-valid Pro license?
	 *
	 * @return bool
	 */
	public static function is_pro() {
		$d = self::data();
		return ! empty( $d['valid'] );
	}

	/**
	 * Does the active license unlock a given premium feature?
	 *
	 * @param string $feature Feature code (see FEATURES).
	 * @return bool
	 */
	public static function can( $feature ) {
		$d = self::data();
		if ( empty( $d['valid'] ) ) {
			return false;
		}
		if ( '*' === $d['features'] ) {
			return true;
		}
		return in_array( $feature, (array) $d['features'], true );
	}

	/**
	 * Validate a license key, returning a structured result.
	 *
	 * @param string $key License key (any grouping/case).
	 * @return array{valid:bool,plan?:string,exp?:int,features?:mixed,serial?:string,error?:string,expired?:bool}
	 */
	public static function validate( $key ) {
		$key = self::normalize( $key );
		if ( '' === $key ) {
			return array( 'valid' => false, 'error' => __( 'No license key entered.', 'agent-ready-shop' ) );
		}

		if ( ! function_exists( 'sodium_crypto_sign_verify_detached' ) ) {
			return array( 'valid' => false, 'error' => __( 'PHP sodium extension is required to validate licenses.', 'agent-ready-shop' ) );
		}

		$blob = self::base32_decode( $key );
		if ( false === $blob || false === strpos( $blob, "\x1f" ) ) {
			return array( 'valid' => false, 'error' => __( 'Malformed license key.', 'agent-ready-shop' ) );
		}

		list( $payload, $sig ) = explode( "\x1f", $blob, 2 );
		$pubkey = base64_decode( self::PUBLIC_KEY, true );
		if ( false === $pubkey || SODIUM_CRYPTO_SIGN_BYTES !== strlen( $sig ) || SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES !== strlen( $pubkey ) ) {
			return array( 'valid' => false, 'error' => __( 'Invalid license key.', 'agent-ready-shop' ) );
		}
		if ( ! sodium_crypto_sign_verify_detached( $sig, $payload, $pubkey ) ) {
			return array( 'valid' => false, 'error' => __( 'Invalid license key (signature mismatch).', 'agent-ready-shop' ) );
		}

		$parts = explode( '|', $payload );
		if ( count( $parts ) < 5 || 'v1' !== $parts[0] ) {
			return array( 'valid' => false, 'error' => __( 'Unsupported license format.', 'agent-ready-shop' ) );
		}

		list( , $plan, $exp, $feat, $serial ) = $parts;

		$exp_ts = 0;
		if ( '0' !== $exp ) {
			$exp_ts = strtotime( $exp . ' 23:59:59' );
			if ( $exp_ts && time() > $exp_ts ) {
				return array(
					'valid'   => false,
					'expired' => true,
					'plan'    => $plan,
					'exp'     => $exp_ts,
					'error'   => sprintf( __( 'License expired on %s.', 'agent-ready-shop' ), $exp ),
				);
			}
		}

		$features = ( '*' === $feat ) ? '*' : array_values( array_filter( explode( ',', $feat ) ) );

		return array(
			'valid'    => true,
			'plan'     => $plan,
			'exp'      => $exp_ts,
			'features' => $features,
			'serial'   => $serial,
		);
	}

	/**
	 * Normalize a key to the base32 alphabet.
	 *
	 * @param string $key Raw key.
	 * @return string
	 */
	private static function normalize( $key ) {
		return preg_replace( '/[^A-Z2-7]/', '', strtoupper( (string) $key ) );
	}

	/**
	 * RFC 4648 base32 decode (no padding required).
	 *
	 * @param string $str Base32 string.
	 * @return string|false
	 */
	private static function base32_decode( $str ) {
		$alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
		$str      = self::normalize( $str );
		$bits     = '';
		for ( $i = 0, $n = strlen( $str ); $i < $n; $i++ ) {
			$v = strpos( $alphabet, $str[ $i ] );
			if ( false === $v ) {
				return false;
			}
			$bits .= str_pad( decbin( $v ), 5, '0', STR_PAD_LEFT );
		}
		$out = '';
		foreach ( str_split( $bits, 8 ) as $byte ) {
			if ( 8 === strlen( $byte ) ) {
				$out .= chr( bindec( $byte ) );
			}
		}
		return $out;
	}
}
