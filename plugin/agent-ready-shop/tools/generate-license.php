<?php
/**
 * Agent Ready Shop — Ed25519 license generator (VENDOR CLI).
 *
 * NOT shipped in the public plugin (excluded by the release build). Requires
 * the private signing key; the plugin only holds the public key.
 *
 * Provide the sodium secret key (base64, 64 bytes) via env:
 *   ARS_LICENSE_SK="…" php generate-license.php --plan=pro --expires=never --features='*'
 *
 * @package AgentReadyShop
 */

if ( 'cli' !== php_sapi_name() ) {
	fwrite( STDERR, "Run from the command line.\n" );
	exit( 1 );
}
if ( ! function_exists( 'sodium_crypto_sign_detached' ) ) {
	fwrite( STDERR, "PHP sodium extension is required.\n" );
	exit( 1 );
}

$sk_b64 = getenv( 'ARS_LICENSE_SK' );
if ( ! $sk_b64 ) {
	fwrite( STDERR, "Set ARS_LICENSE_SK (base64 of the 64-byte Ed25519 secret key).\n" );
	exit( 1 );
}
$sk = base64_decode( $sk_b64, true );
if ( false === $sk || SODIUM_CRYPTO_SIGN_SECRETKEYBYTES !== strlen( $sk ) ) {
	fwrite( STDERR, "Invalid ARS_LICENSE_SK.\n" );
	exit( 1 );
}

$opts     = getopt( '', array( 'plan::', 'expires::', 'features::', 'count::' ) );
$plan     = isset( $opts['plan'] ) ? preg_replace( '/[^a-z0-9_-]/i', '', $opts['plan'] ) : 'pro';
$features = $opts['features'] ?? '*';
$count    = isset( $opts['count'] ) ? max( 1, (int) $opts['count'] ) : 1;
$exp_in   = isset( $opts['expires'] ) ? strtolower( $opts['expires'] ) : 'never';
$exp      = ( 'never' === $exp_in || '0' === $exp_in || '' === $exp_in ) ? '0' : gmdate( 'Ymd', strtotime( $exp_in ) );

function afs_base32_encode( $data ) {
	$alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	$bits     = '';
	for ( $i = 0, $n = strlen( $data ); $i < $n; $i++ ) {
		$bits .= str_pad( decbin( ord( $data[ $i ] ) ), 8, '0', STR_PAD_LEFT );
	}
	$out = '';
	foreach ( str_split( $bits, 5 ) as $chunk ) {
		$out .= $alphabet[ bindec( str_pad( $chunk, 5, '0', STR_PAD_RIGHT ) ) ];
	}
	return $out;
}

echo str_repeat( '-', 60 ) . "\n";
echo "Agent Ready Shop — license keys (Ed25519)\n";
echo "  plan: {$plan} · expires: " . ( '0' === $exp ? 'never' : $exp ) . " · features: {$features}\n";
echo str_repeat( '-', 60 ) . "\n";

for ( $i = 0; $i < $count; $i++ ) {
	$serial  = substr( bin2hex( random_bytes( 4 ) ), 0, 6 );
	$payload = "v1|{$plan}|{$exp}|{$features}|{$serial}";
	$sig     = sodium_crypto_sign_detached( $payload, $sk );
	$key     = afs_base32_encode( $payload . "\x1f" . $sig );
	echo implode( '-', str_split( $key, 5 ) ) . "\n";
}
