<?php
/**
 * Agent Ready Shop — PHP port of the web service (server.ts + src/utils/badge.ts).
 *
 * Lets the analyzer, badge, verifier and plugin download run on ordinary PHP
 * hosting: upload the built folder, no Node process and no URL rewrites needed.
 * Keep the scoring rubric and certificate algorithm in sync with the TS source.
 */

const ARS_VERSION   = '1.0.0';
const ARS_SECRET    = 'agent-ready-shop:v1';
const ARS_AUDIT_TTL = 900; // seconds
const ARS_MAX_BODY  = 3000000; // bytes read per response
const ARS_UA        = 'Mozilla/5.0 (compatible; AgentReadyShop/1.0; +https://agentreadyshop.com/bot)';

/* ---------- certificate + badge (mirrors src/utils/badge.ts) ---------- */

function ars_djb2( $str ) {
	$h = 5381;
	$n = strlen( $str );
	for ( $i = 0; $i < $n; $i++ ) {
		$h = ( $h * 33 + ord( $str[ $i ] ) ) % 4294967296;
	}
	return $h;
}

function ars_b36( $n ) {
	return substr( str_pad( strtoupper( base_convert( (string) $n, 10, 36 ) ), 6, '0', STR_PAD_LEFT ), -6 );
}

function ars_normalize_domain( $input ) {
	$d = strtolower( trim( (string) $input ) );
	$d = preg_replace( '#^https?://#', '', $d );
	$d = preg_replace( '#/.*$#s', '', $d );
	return preg_replace( '#^www\.#', '', $d );
}

function ars_tier( $score ) {
	return $score >= 85 ? 'gold' : ( $score >= 60 ? 'blue' : 'none' );
}

function ars_tier_label( $t ) {
	return 'gold' === $t ? 'Certified · Agent-Transacting' : ( 'blue' === $t ? 'Verified · Agent-Readable' : 'Not yet certified' );
}

function ars_tier_short( $t ) {
	return 'gold' === $t ? 'CERTIFIED' : ( 'blue' === $t ? 'VERIFIED' : 'NOT READY' );
}

function ars_cert_id( $domain ) {
	$d = ars_normalize_domain( $domain );
	return 'ARS-' . ars_b36( ars_djb2( $d ) ) . '-' . ars_b36( ars_djb2( ARS_SECRET . $d ) );
}

function ars_esc( $s ) {
	return htmlspecialchars( (string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8' );
}

function ars_badge_svg( $domain, $score, $style = 'dark' ) {
	$colors = array(
		'gold' => array( '#b8860b', '#e9c766' ),
		'blue' => array( '#10a37f', '#5fded0' ),
		'none' => array( '#8c8f94', '#c3c4c7' ),
	);
	$tier = ars_tier( $score );
	list( $accent, $soft ) = $colors[ $tier ];
	$dark   = 'light' !== $style;
	$bg     = $dark ? '#1d2327' : '#ffffff';
	$stroke = $dark ? 'none' : '#dcdcde';
	$main   = $dark ? '#ffffff' : '#1d2327';
	$short  = ars_tier_short( $tier );
	$dom    = ars_esc( substr( ars_normalize_domain( $domain ), 0, 26 ) );
	$score  = (int) $score;

	return <<<SVG
<svg width="240" height="56" viewBox="0 0 240 56" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Agent Ready {$short}">
  <rect x="0.5" y="0.5" width="239" height="55" rx="7" fill="{$bg}" stroke="{$stroke}"/>
  <g transform="translate(16,14)">
    <rect width="28" height="28" rx="7" fill="{$accent}"/>
    <rect x="7" y="9" width="14" height="11" rx="2.5" fill="#ffffff"/>
    <circle cx="11" cy="14.5" r="1.7" fill="{$accent}"/>
    <circle cx="17" cy="14.5" r="1.7" fill="{$accent}"/>
    <rect x="12.5" y="3.5" width="3" height="4" rx="1.5" fill="#ffffff"/>
  </g>
  <text x="54" y="24" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="{$main}" letter-spacing="0.3">AGENT READY</text>
  <text x="54" y="39" font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="700" fill="{$accent}" letter-spacing="0.6">{$short}</text>
  <text x="54" y="50" font-family="Arial, Helvetica, sans-serif" font-size="8" fill="#8c8f94">{$dom}</text>
  <rect x="184" y="13" width="42" height="30" rx="5" fill="{$accent}"/>
  <text x="205" y="30" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">{$score}</text>
  <text x="205" y="39" font-family="Arial, Helvetica, sans-serif" font-size="6.5" fill="{$soft}" text-anchor="middle" letter-spacing="0.5">/ 100 AIO</text>
</svg>
SVG;
}

/* ---------- fetching ---------- */

/** Only audit public hosts — never let the auditor be pointed at internal addresses. */
function ars_is_public_host( $host ) {
	if ( '' === $host ) {
		return false;
	}
	$ips = filter_var( $host, FILTER_VALIDATE_IP ) ? array( $host ) : gethostbynamel( $host );
	if ( ! $ips ) {
		return false;
	}
	foreach ( $ips as $ip ) {
		if ( ! filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE ) ) {
			return false;
		}
	}
	return true;
}

function ars_curl( $url, $timeout ) {
	$ch = curl_init( $url );
	curl_setopt_array( $ch, array(
		CURLOPT_RETURNTRANSFER => true,
		CURLOPT_FOLLOWLOCATION => true,
		CURLOPT_MAXREDIRS      => 5,
		CURLOPT_TIMEOUT        => $timeout,
		CURLOPT_CONNECTTIMEOUT => min( 6, $timeout ),
		CURLOPT_USERAGENT      => ARS_UA,
		CURLOPT_ENCODING       => '',
		CURLOPT_HTTPHEADER     => array( 'Accept: text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' ),
		CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
		CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
	) );
	return $ch;
}

function ars_curl_result( $ch, $body, $url ) {
	if ( curl_errno( $ch ) || ! is_string( $body ) ) {
		return null;
	}
	$status = (int) curl_getinfo( $ch, CURLINFO_RESPONSE_CODE );
	if ( ! $status ) {
		return null;
	}
	return array(
		'status'   => $status,
		'ok'       => $status >= 200 && $status < 300,
		'text'     => substr( $body, 0, ARS_MAX_BODY ),
		'finalUrl' => curl_getinfo( $ch, CURLINFO_EFFECTIVE_URL ) ?: $url,
	);
}

/** Fetch with retry — a flaky network must not change a store's score. */
function ars_fetch( $url, $timeout = 8, $retries = 1 ) {
	for ( $i = 0; $i <= $retries; $i++ ) {
		$ch  = ars_curl( $url, $timeout );
		$out = ars_curl_result( $ch, curl_exec( $ch ), $url );
		curl_close( $ch );
		if ( $out ) {
			return $out;
		}
		if ( $i < $retries ) {
			usleep( 500000 );
		}
	}
	return null;
}

/** Fetch several URLs in parallel. Returns results keyed like the input. */
function ars_fetch_all( array $urls, $timeout = 6 ) {
	$mh      = curl_multi_init();
	$handles = array();
	foreach ( $urls as $k => $u ) {
		$handles[ $k ] = ars_curl( $u, $timeout );
		curl_multi_add_handle( $mh, $handles[ $k ] );
	}
	do {
		$status = curl_multi_exec( $mh, $running );
		if ( $running ) {
			curl_multi_select( $mh, 1.0 );
		}
	} while ( $running && CURLM_OK === $status );

	$errors = array();
	while ( $info = curl_multi_info_read( $mh ) ) {
		$errors[ (int) $info['handle'] ] = $info['result'];
	}
	$out = array();
	foreach ( $handles as $k => $ch ) {
		$failed    = ! empty( $errors[ (int) $ch ] );
		$out[ $k ] = $failed ? null : ars_curl_result( $ch, curl_multi_getcontent( $ch ), $urls[ $k ] );
		curl_multi_remove_handle( $mh, $ch );
		curl_close( $ch );
	}
	curl_multi_close( $mh );
	return $out;
}

/* ---------- audit (mirrors runAudit in server.ts) ---------- */

function ars_origin( $url ) {
	$p = parse_url( $url );
	if ( empty( $p['scheme'] ) || empty( $p['host'] ) ) {
		return null;
	}
	return strtolower( $p['scheme'] ) . '://' . strtolower( $p['host'] ) . ( isset( $p['port'] ) ? ':' . $p['port'] : '' );
}

// A 200 status is meaningless on its own: SPAs and WAFs answer 200 with an HTML
// shell for ANY path, so every body is validated.
function ars_is_html_doc( $t ) {
	return (bool) preg_match( '/^\s*(<!doctype|<html|<head|<body|<script)/i', substr( $t, 0, 300 ) );
}

function ars_is_xml_of( $t, $pattern ) {
	return (bool) preg_match( $pattern, substr( $t, 0, 4000 ) );
}

function ars_json_ok( $res ) {
	return $res && 200 === $res['status'] && null !== json_decode( $res['text'], true );
}

function ars_extract_locs( $xml ) {
	preg_match_all( '#<loc>\s*([^<]+?)\s*</loc>#i', $xml, $m );
	$locs = array();
	foreach ( $m[1] as $l ) {
		$l = trim( $l );
		if ( '.gz' !== substr( $l, -3 ) ) {
			$locs[] = html_entity_decode( $l, ENT_QUOTES | ENT_XML1, 'UTF-8' );
		}
	}
	return $locs;
}

function ars_is_xml_url( $l ) {
	return (bool) preg_match( '/\.xml(\?|$)/i', $l );
}

/** Find a real product URL from a sitemap (descends one index level). Deterministic. */
function ars_find_product_url( $xml ) {
	$locs = ars_extract_locs( $xml );
	if ( $locs && count( array_filter( $locs, 'ars_is_xml_url' ) ) === count( $locs ) ) {
		$child = $locs[0];
		foreach ( $locs as $l ) {
			if ( preg_match( '/product|produkt|item|shop/i', $l ) ) {
				$child = $l;
				break;
			}
		}
		$host = parse_url( $child, PHP_URL_HOST );
		$res  = $host && ars_is_public_host( $host ) ? ars_fetch( $child, 8, 1 ) : null;
		$locs = $res && $res['ok'] ? ars_extract_locs( $res['text'] ) : array();
	}
	$pages = array_values( array_filter( $locs, function ( $l ) {
		return ! ars_is_xml_url( $l );
	} ) );
	if ( ! $pages ) {
		return null;
	}
	$product_like = array_values( array_filter( $pages, function ( $l ) {
		return (bool) preg_match( '#/(product|produkt|p|item|dp)/#i', $l );
	} ) );
	if ( $product_like ) {
		sort( $product_like, SORT_STRING );
		return $product_like[0];
	}
	$pages = array_slice( $pages, 0, 50 );
	usort( $pages, function ( $a, $b ) {
		return ( strlen( $b ) - strlen( $a ) ) ?: strcmp( $a, $b );
	} );
	return $pages[0];
}

function ars_looks_like_product_schema( $html ) {
	foreach ( array( '"@type":"product"', '"@type": "product"', '"@type":"offer"', 'og:type" content="product', "og:type' content='product" ) as $needle ) {
		if ( false !== strpos( $html, $needle ) ) {
			return true;
		}
	}
	return false;
}

function ars_cache_file( $origin ) {
	return rtrim( sys_get_temp_dir(), '/\\' ) . '/ars-audit-' . md5( $origin ) . '.json';
}

/**
 * Live audit of a store. Throws InvalidArgumentException for unusable targets.
 */
function ars_run_audit( $target ) {
	$target = trim( (string) $target );
	if ( ! preg_match( '#^https?://#i', $target ) ) {
		$target = 'https://' . $target;
	}
	$requested = ars_origin( $target );
	if ( ! $requested ) {
		throw new InvalidArgumentException( 'Invalid URL' );
	}

	$cache = ars_cache_file( $requested );
	if ( is_file( $cache ) && time() - filemtime( $cache ) < ARS_AUDIT_TTL ) {
		$data = json_decode( (string) @file_get_contents( $cache ), true );
		if ( is_array( $data ) ) {
			return $data;
		}
	}

	if ( ! ars_is_public_host( parse_url( $requested, PHP_URL_HOST ) ) ) {
		throw new InvalidArgumentException( 'Host is not reachable' );
	}

	$platform        = 'Unknown / Custom Solution';
	$is_woo          = false;
	$plugin_detected = false;
	// Platform-agnostic AIO rubric (100).
	$s = array(
		'robots' => array( 'score' => 0, 'pass' => false ), // 15 — AI crawler policy
		'schema' => array( 'score' => 0, 'pass' => false ), // 20 — Schema.org structured data
		'llms'   => array( 'score' => 0, 'pass' => false ), // 15 — llms.txt
		'feed'   => array( 'score' => 0, 'pass' => false ), // 15 — product feed / sitemap
		'api'    => array( 'score' => 0, 'pass' => false ), // 15 — structured product API
		'agent'  => array( 'score' => 0, 'pass' => false ), // 20 — agent-commerce layer
	);

	// 1) Homepage first; its FINAL origin anchors every other probe.
	$blocked = false;
	$origin  = $requested;
	$home    = ars_fetch( $requested . '/', 10, 1 );
	if ( $home ) {
		$final = ars_origin( $home['finalUrl'] );
		if ( $final && ars_is_public_host( parse_url( $final, PHP_URL_HOST ) ) ) {
			$origin = $final;
		}
		if ( in_array( $home['status'], array( 401, 403, 429, 503 ), true ) ) {
			$blocked = true;
		}
		if ( $home['ok'] ) {
			$html = strtolower( $home['text'] );
			if ( strlen( $html ) < 20000 && preg_match( '/captcha|cf-chl|challenge-platform|attention required|access denied|are you a robot|just a moment|akamai|incapsula|perimeterx|datadome/', $html ) ) {
				$blocked = true;
			}
			$has = function ( $needle ) use ( $html ) {
				return false !== strpos( $html, $needle );
			};
			if ( $has( 'wp-content' ) || $has( 'wordpress' ) ) {
				$platform = 'WordPress';
				if ( $has( 'woocommerce' ) ) {
					$platform = 'WordPress / WooCommerce';
					$is_woo   = true;
				}
			} elseif ( $has( 'cdn.shopify.com' ) || $has( 'var shopify' ) ) {
				$platform = 'Shopify';
			} elseif ( $has( 'shoptet' ) ) {
				$platform = 'Shoptet';
			} elseif ( $has( 'upgates' ) ) {
				$platform = 'Upgates';
			} elseif ( $has( 'prestashop' ) ) {
				$platform = 'PrestaShop';
			} elseif ( $has( 'magento' ) || $has( 'mage/' ) ) {
				$platform = 'Magento';
			}

			if ( ars_looks_like_product_schema( $html ) ) {
				$s['schema'] = array( 'score' => 20, 'pass' => true );
			} elseif ( $has( 'application/ld+json' ) ) {
				$s['schema'] = array( 'score' => 14, 'pass' => false );
			}
		}
	}
	if ( $blocked && 'Unknown / Custom Solution' === $platform ) {
		$platform = 'Unknown (bot-blocked)';
	}

	// 2) Independent probes in parallel against the canonical origin.
	$r = ars_fetch_all( array(
		'rob'     => $origin . '/robots.txt',
		'llm'     => $origin . '/llms.txt',
		'sitemap' => $origin . '/sitemap.xml',
		'feed'    => $origin . '/agent-shop-feed.xml',
		'pj'      => $origin . '/products.json',
		'aip'     => $origin . '/.well-known/ai-plugin.json',
		'man'     => $origin . '/.well-known/agent-shop.json',
		'acp'     => $origin . '/.well-known/agentic-commerce.json',
		'mcp'     => $origin . '/.well-known/mcp.json',
	), 8 );

	// robots.txt — must actually BE a robots file, not an HTML fallback.
	$s['robots'] = array( 'score' => 8, 'pass' => false ); // neutral
	if ( $r['rob'] && $r['rob']['ok'] && ! ars_is_html_doc( $r['rob']['text'] ) ) {
		$t = strtolower( $r['rob']['text'] );
		if ( preg_match( '/user-agent:\s*gptbot\s*[\r\n]+\s*disallow:\s*\/\s*$/m', $t ) ) {
			$s['robots'] = array( 'score' => 0, 'pass' => false ); // explicitly blocks AI
		} elseif ( preg_match( '/(gptbot|claudebot|google-extended|perplexitybot)/', $t ) ) {
			$s['robots'] = array( 'score' => 15, 'pass' => true );
		}
	}

	// llms.txt — 200 + genuinely text.
	if ( $r['llm'] && 200 === $r['llm']['status'] && ! ars_is_html_doc( $r['llm']['text'] ) && strlen( trim( $r['llm']['text'] ) ) > 40 ) {
		$s['llms'] = array( 'score' => 15, 'pass' => true );
	}

	$pj            = $r['pj'] && 200 === $r['pj']['status'] ? json_decode( $r['pj']['text'], true ) : null;
	$pj_valid      = is_array( $pj ) && isset( $pj['products'] ) && is_array( $pj['products'] ) && count( $pj['products'] ) > 0;
	$feed_valid    = $r['feed'] && 200 === $r['feed']['status'] && ars_is_xml_of( $r['feed']['text'], '/<(rss|feed)[\s>]/i' );
	$sitemap_valid = $r['sitemap'] && 200 === $r['sitemap']['status'] && ars_is_xml_of( $r['sitemap']['text'], '/<(urlset|sitemapindex)[\s>]/i' );

	if ( $feed_valid || $pj_valid ) {
		$s['feed'] = array( 'score' => 15, 'pass' => true );
	} elseif ( $sitemap_valid ) {
		$s['feed'] = array( 'score' => 10, 'pass' => false ); // discovery only
	}

	if ( $pj_valid || ars_json_ok( $r['aip'] ) ) {
		$s['api'] = array( 'score' => 15, 'pass' => true );
	}

	// Deterministic agent-commerce layer (our plugin / ACP / MCP discovery).
	$man = $r['man'] && 200 === $r['man']['status'] ? json_decode( $r['man']['text'], true ) : null;
	if ( is_array( $man ) && isset( $man['generator'] ) && is_string( $man['generator'] ) && false !== strpos( $man['generator'], 'agent' ) ) {
		$plugin_detected = true;
		$s['agent']      = array( 'score' => 20, 'pass' => true );
		if ( ! $s['api']['pass'] ) {
			$s['api'] = array( 'score' => 15, 'pass' => true );
		}
		if ( ! $s['feed']['pass'] ) {
			$s['feed'] = array( 'score' => 15, 'pass' => true );
		}
	} elseif ( ars_json_ok( $r['acp'] ) || ars_json_ok( $r['mcp'] ) ) {
		$s['agent'] = array( 'score' => 14, 'pass' => false );
	}

	// 3) Homepage rarely carries Product schema — audit a real product page from the sitemap.
	$product_page = null;
	if ( ! $s['schema']['pass'] && $sitemap_valid ) {
		$product_page = ars_find_product_url( $r['sitemap']['text'] );
		$host         = $product_page ? parse_url( $product_page, PHP_URL_HOST ) : null;
		if ( $host && ars_is_public_host( $host ) ) {
			$pp = ars_fetch( $product_page, 10, 1 );
			if ( $pp && $pp['ok'] ) {
				$ph = strtolower( $pp['text'] );
				if ( ars_looks_like_product_schema( $ph ) ) {
					$s['schema'] = array( 'score' => 20, 'pass' => true );
				} elseif ( false !== strpos( $ph, 'application/ld+json' ) && $s['schema']['score'] < 14 ) {
					$s['schema'] = array( 'score' => 14, 'pass' => false );
				}
			}
		}
	}

	$total = 0;
	foreach ( $s as $x ) {
		$total += $x['score'];
	}
	$data = array(
		'origin'         => $origin,
		'platform'       => $platform,
		'isWooCommerce'  => $is_woo,
		'pluginDetected' => $plugin_detected,
		'blocked'        => $blocked,
		'productPage'    => $product_page,
		'scores'         => $s,
		'total'          => $total,
	);
	$json = json_encode( $data );
	@file_put_contents( $cache, $json, LOCK_EX );
	if ( $origin !== $requested ) {
		@file_put_contents( ars_cache_file( $origin ), $json, LOCK_EX );
	}
	return $data;
}
