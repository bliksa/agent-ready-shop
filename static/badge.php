<?php
/** Embeddable SVG trust badge: badge.php?d=store.com&s=92&style=dark|light */
require __DIR__ . '/lib.php';

$domain = isset( $_GET['d'] ) && '' !== $_GET['d'] ? (string) $_GET['d'] : 'your-store.com';
$score  = max( 0, min( 100, isset( $_GET['s'] ) ? (int) $_GET['s'] : 0 ) );
$style  = isset( $_GET['style'] ) && 'light' === $_GET['style'] ? 'light' : 'dark';

header( 'Content-Type: image/svg+xml; charset=utf-8' );
header( 'Cache-Control: public, max-age=3600' );
echo ars_badge_svg( $domain, $score, $style );
