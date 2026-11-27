<?php
/**
 * JSON API for the static (PHP-hosted) build.
 *   api.php?action=run-audit&url=example.com
 *   api.php?action=update            (plugin auto-update manifest)
 */
require __DIR__ . '/lib.php';

function ars_json( $data, $code = 200 ) {
	http_response_code( $code );
	header( 'Content-Type: application/json; charset=utf-8' );
	header( 'Cache-Control: no-store' );
	echo json_encode( $data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
	exit;
}

$action = isset( $_GET['action'] ) ? (string) $_GET['action'] : '';

if ( 'run-audit' === $action ) {
	$url = isset( $_GET['url'] ) ? trim( (string) $_GET['url'] ) : '';
	if ( '' === $url ) {
		ars_json( array( 'error' => 'URL is required' ), 400 );
	}
	if ( ! function_exists( 'curl_init' ) ) {
		ars_json( array( 'error' => 'The PHP cURL extension is required' ), 500 );
	}
	@set_time_limit( 90 );
	try {
		$a = ars_run_audit( $url );
	} catch ( InvalidArgumentException $e ) {
		ars_json( array( 'error' => $e->getMessage() ), 400 );
	} catch ( Throwable $e ) {
		ars_json( array( 'error' => 'Audit failed' ), 500 );
	}
	unset( $a['origin'], $a['total'] );
	ars_json( $a );
}

if ( 'update' === $action ) {
	$https = ( ! empty( $_SERVER['HTTPS'] ) && 'off' !== $_SERVER['HTTPS'] ) || ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO'] );
	$host  = preg_replace( '/[^a-z0-9.:\-]/i', '', isset( $_SERVER['HTTP_HOST'] ) ? $_SERVER['HTTP_HOST'] : 'localhost' );
	$dir   = rtrim( str_replace( '\\', '/', dirname( $_SERVER['SCRIPT_NAME'] ) ), '/' );
	ars_json( array(
		'version'      => ARS_VERSION,
		'download_url' => ( $https ? 'https' : 'http' ) . '://' . $host . $dir . '/agent-ready-shop.zip',
		'tested'       => '6.6',
		'requires'     => '6.0',
		'requires_php' => '7.4',
		'changelog'    => 'See agentreadyshop.com/changelog',
	) );
}

ars_json( array( 'error' => 'Not available on this site' ), 404 );
