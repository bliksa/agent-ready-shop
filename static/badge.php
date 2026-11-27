<?php
/**
 * Embeddable SVG trust badge: badge.php?d=store.com&style=dark|light
 *
 * The score is NOT taken from the URL. It comes from the last live audit this
 * server ran for the domain (refreshed once a day), so a badge cannot claim a
 * score or a certification the store did not earn.
 */
require __DIR__ . '/lib.php';

$domain = isset( $_GET['d'] ) ? ars_normalize_domain( (string) $_GET['d'] ) : '';
$style  = isset( $_GET['style'] ) && 'light' === $_GET['style'] ? 'light' : 'dark';
$audit  = ars_badge_audit( $domain );

header( 'Content-Type: image/svg+xml; charset=utf-8' );
header( 'Cache-Control: public, max-age=3600' );
header( 'X-Content-Type-Options: nosniff' );
echo ars_badge_svg( '' !== $domain ? $domain : 'unknown', $audit ? (int) $audit['total'] : null, $style, ars_is_certified( $audit ) );
