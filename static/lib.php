<?php
/**
 * Agent Ready Shop — PHP port of the web service (server.ts + src/utils/badge.ts).
 *
 * Lets the analyzer, badge, verifier and plugin download run on ordinary PHP
 * hosting: upload the built folder, no Node process and no URL rewrites needed.
 * Keep the scoring rubric and certificate algorithm in sync with the TS source.
 *
 * Trust model: a badge or certificate is only ever as good as the last LIVE
 * audit this server ran itself. Nothing a caller puts in a URL (score, ID)
 * is believed.
 */

const ARS_VERSION   = '1.0.0';
const ARS_SECRET    = 'agent-ready-shop:v1'; // public constant: the ID is a reference label, not a proof
const ARS_AUDIT_TTL = 900;   // seconds an audit result is reused
const ARS_BADGE_TTL = 86400; // seconds before a badge triggers a re-audit
const ARS_RATE_IP   = 12;    // fresh audits per client IP per 10 minutes
const ARS_RATE_ALL  = 300;   // fresh audits site-wide per hour
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

/**
 * @param string   $domain Store domain.
 * @param int|null $score  Live score, or null when the store was never audited.
 * @param string   $style  dark|light.
 * @param bool     $certified Whether the last live audit certified the store.
 */
function ars_badge_svg( $domain, $score, $style = 'dark', $certified = true ) {
	$colors = array(
		'gold' => array( '#d97757', '#3a1d12' ),
		'blue' => array( '#b9a37e', '#2f2718' ),
		'none' => array( '#6f747b', '#d6d8db' ),
	);
	$tier = $certified && null !== $score ? ars_tier( $score ) : 'none';
	list( $accent, $soft ) = $colors[ $tier ];
	$dark   = 'light' !== $style;
	$bg     = $dark ? '#0a0b0d' : '#ece9e2';
	$stroke = $dark ? '#33363b' : '#c9c5bb';
	$main   = $dark ? '#ece9e2' : '#0a0b0d';
	$sub    = $dark ? '#6f747b' : '#5c6066';
	$on     = 'none' === $tier ? '#ffffff' : '#0a0b0d';
	$small  = 'none' === $tier ? $soft : $on;
	$short  = 'none' === $tier ? 'NOT VERIFIED' : ars_tier_short( $tier );
	$dom    = preg_replace( '/[^a-z0-9.\-]/', '', substr( ars_normalize_domain( $domain ), 0, 26 ) );
	$num    = null === $score ? '–' : (string) (int) $score;
	$mono   = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";
	$sans   = "'Helvetica Neue', Helvetica, Arial, sans-serif";

	return <<<SVG
<svg width="240" height="56" viewBox="0 0 240 56" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Agent Ready {$short}">
  <rect x="0.5" y="0.5" width="239" height="55" fill="{$bg}" stroke="{$stroke}"/>
  <rect x="14" y="13" width="3" height="30" fill="{$accent}"/>
  <text x="26" y="25" font-family="{$sans}" font-size="13" font-weight="700" fill="{$main}" letter-spacing="1.6">AGENT READY</text>
  <text x="26" y="38" font-family="{$mono}" font-size="8.5" font-weight="500" fill="{$accent}" letter-spacing="1.2">{$short}</text>
  <text x="26" y="49" font-family="{$mono}" font-size="7.5" fill="{$sub}">{$dom}</text>
  <rect x="184" y="13" width="42" height="30" fill="{$accent}"/>
  <text x="205" y="31" font-family="{$sans}" font-size="16" font-weight="700" fill="{$on}" text-anchor="middle">{$num}</text>
  <text x="205" y="39.5" font-family="{$mono}" font-size="5.5" fill="{$small}" text-anchor="middle" letter-spacing="0.6">/ 100 AIO</text>
</svg>
SVG;
}

/* ---------- storage + rate limiting ---------- */

/** Private, non-web-readable data directory next to the scripts (falls back to the temp dir). */
function ars_data_dir() {
	static $dir = null;
	if ( null !== $dir ) {
		return $dir;
	}
	$dir = __DIR__ . '/data';
	if ( ! is_dir( $dir ) ) {
		@mkdir( $dir, 0755, true );
	}
	if ( is_dir( $dir ) && is_writable( $dir ) ) {
		if ( ! is_file( $dir . '/.htaccess' ) ) {
			@file_put_contents( $dir . '/.htaccess', "Require all denied\nDeny from all\n" );
			@file_put_contents( $dir . '/index.html', '' );
		}
		return $dir;
	}
	$dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/ars-data';
	if ( ! is_dir( $dir ) ) {
		@mkdir( $dir, 0700, true );
	}
	return $dir;
}

/**
 * Sliding-window counter. Returns false (and records nothing) once $limit hits
 * were made within $window seconds.
 */
function ars_rate_ok( $bucket, $limit, $window ) {
	$fh = @fopen( ars_data_dir() . '/rate-' . md5( $bucket ) . '.json', 'c+' );
	if ( ! $fh ) {
		return true; // storage unavailable — fail open rather than break the site
	}
	flock( $fh, LOCK_EX );
	$now  = time();
	$hits = json_decode( (string) stream_get_contents( $fh ), true );
	$hits = array_values( array_filter( is_array( $hits ) ? $hits : array(), function ( $t ) use ( $now, $window ) {
		return is_int( $t ) && $t > $now - $window;
	} ) );
	$ok = count( $hits ) < $limit;
	if ( $ok ) {
		$hits[] = $now;
	}
	ftruncate( $fh, 0 );
	rewind( $fh );
	fwrite( $fh, json_encode( $hits ) );
	flock( $fh, LOCK_UN );
	fclose( $fh );
	return $ok;
}

function ars_client_ip() {
	return isset( $_SERVER['REMOTE_ADDR'] ) ? (string) $_SERVER['REMOTE_ADDR'] : 'cli';
}

class ARS_Rate_Limited extends RuntimeException {}

/* ---------- fetching (SSRF-safe) ---------- */

function ars_ip_is_public( $ip ) {
	if ( ! filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE ) ) {
		return false;
	}
	if ( false !== strpos( $ip, ':' ) ) {
		$bin = @inet_pton( $ip );
		if ( false === $bin ) {
			return false;
		}
		// IPv4-mapped (::ffff:a.b.c.d) / NAT64 (64:ff9b::/96) wrap an IPv4 address: judge that instead.
		if ( "\0\0\0\0\0\0\0\0\0\0\xff\xff" === substr( $bin, 0, 12 ) || "\x00\x64\xff\x9b\0\0\0\0\0\0\0\0" === substr( $bin, 0, 12 ) ) {
			return ars_ip_is_public( inet_ntop( substr( $bin, 12 ) ) );
		}
		$first = ord( $bin[0] );
		// Unique-local fc00::/7, link-local fe80::/10, multicast ff00::/8.
		if ( 0xfc === ( $first & 0xfe ) || ( 0xfe === $first && 0x80 === ( ord( $bin[1] ) & 0xc0 ) ) || 0xff === $first ) {
			return false;
		}
		return true;
	}
	// Carrier-grade NAT 100.64.0.0/10 is not covered by the PHP filter flags.
	$long = ip2long( $ip );
	return ! ( false !== $long && ( $long & 0xffc00000 ) === ip2long( '100.64.0.0' ) );
}

/**
 * Resolve a host and return ONE address to connect to, or null unless EVERY
 * address it resolves to (IPv4 and IPv6) is public. The request is then pinned
 * to that address, so a second DNS answer cannot redirect it to an internal host.
 */
function ars_resolve_public( $host ) {
	static $memo = array();
	$host = strtolower( trim( (string) $host, '[]' ) );
	if ( '' === $host ) {
		return null;
	}
	if ( array_key_exists( $host, $memo ) ) {
		return $memo[ $host ];
	}
	$ips = array();
	if ( filter_var( $host, FILTER_VALIDATE_IP ) ) {
		$ips[] = $host;
	} else {
		$v4 = @gethostbynamel( $host );
		if ( $v4 ) {
			$ips = $v4;
		}
		if ( function_exists( 'dns_get_record' ) ) {
			$v6 = @dns_get_record( $host, DNS_AAAA );
			foreach ( is_array( $v6 ) ? $v6 : array() as $rec ) {
				if ( ! empty( $rec['ipv6'] ) ) {
					$ips[] = $rec['ipv6'];
				}
			}
		}
	}
	$pick = null;
	foreach ( $ips as $ip ) {
		if ( ! ars_ip_is_public( $ip ) ) {
			return $memo[ $host ] = null;
		}
		if ( null === $pick ) {
			$pick = $ip;
		}
	}
	return $memo[ $host ] = $pick;
}

function ars_is_public_host( $host ) {
	return null !== ars_resolve_public( $host );
}

/** A URL the auditor may request: http(s), default port, public host. Returns [host, port, ip] or null. */
function ars_url_target( $url ) {
	$p = parse_url( (string) $url );
	if ( ! $p || empty( $p['host'] ) || empty( $p['scheme'] ) || isset( $p['user'] ) || isset( $p['pass'] ) ) {
		return null;
	}
	$scheme = strtolower( $p['scheme'] );
	if ( 'http' !== $scheme && 'https' !== $scheme ) {
		return null;
	}
	$port = 'https' === $scheme ? 443 : 80;
	if ( isset( $p['port'] ) && (int) $p['port'] !== $port ) {
		return null;
	}
	$ip = ars_resolve_public( $p['host'] );
	return $ip ? array( strtolower( $p['host'] ), $port, $ip ) : null;
}

function ars_curl( $url, $timeout, array $target ) {
	list( $host, $port, $ip ) = $target;
	$ch = curl_init( $url );
	curl_setopt_array( $ch, array(
		CURLOPT_RETURNTRANSFER  => true,
		CURLOPT_FOLLOWLOCATION  => false, // redirects are followed by hand so every hop is re-validated
		CURLOPT_TIMEOUT         => $timeout,
		CURLOPT_CONNECTTIMEOUT  => min( 6, $timeout ),
		CURLOPT_USERAGENT       => ARS_UA,
		CURLOPT_ENCODING        => '',
		CURLOPT_HTTPHEADER      => array( 'Accept: text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' ),
		CURLOPT_PROTOCOLS       => CURLPROTO_HTTP | CURLPROTO_HTTPS,
		CURLOPT_RESOLVE         => array( $host . ':' . $port . ':' . ( false !== strpos( $ip, ':' ) ? '[' . $ip . ']' : $ip ) ),
		CURLOPT_NOPROGRESS      => false,
		CURLOPT_PROGRESSFUNCTION => function ( $ch, $dl_total, $dl_now ) {
			return $dl_now > ARS_MAX_BODY ? 1 : 0; // abort oversized downloads
		},
	) );
	return $ch;
}

/**
 * Fetch several URLs in parallel, following up to 5 redirects per URL with the
 * target of every hop validated. Returns results keyed like the input; null on
 * failure or when a hop points at a non-public address.
 */
function ars_fetch_all( array $urls, $timeout = 6 ) {
	$out     = array_fill_keys( array_keys( $urls ), null );
	$pending = $urls;
	for ( $hop = 0; $hop <= 5 && $pending; $hop++ ) {
		$mh      = curl_multi_init();
		$handles = array();
		foreach ( $pending as $k => $u ) {
			$target = ars_url_target( $u );
			if ( ! $target ) {
				continue;
			}
			$handles[ $k ] = ars_curl( $u, $timeout, $target );
			curl_multi_add_handle( $mh, $handles[ $k ] );
		}
		do {
			$status = curl_multi_exec( $mh, $running );
			if ( $running ) {
				curl_multi_select( $mh, 1.0 );
			}
		} while ( $running && CURLM_OK === $status );

		$failed = array();
		while ( $info = curl_multi_info_read( $mh ) ) {
			if ( CURLE_OK !== $info['result'] ) {
				$failed[] = $info['handle'];
			}
		}
		$next = array();
		foreach ( $handles as $k => $ch ) {
			$body = curl_multi_getcontent( $ch );
			$code = (int) curl_getinfo( $ch, CURLINFO_RESPONSE_CODE );
			if ( ! in_array( $ch, $failed, true ) && $code && is_string( $body ) ) {
				$redirect = $code >= 300 && $code < 400 ? (string) curl_getinfo( $ch, CURLINFO_REDIRECT_URL ) : '';
				if ( '' !== $redirect ) {
					$next[ $k ] = $redirect;
				} else {
					$out[ $k ] = array(
						'status'   => $code,
						'ok'       => $code >= 200 && $code < 300,
						'text'     => substr( $body, 0, ARS_MAX_BODY ),
						'finalUrl' => $pending[ $k ],
					);
				}
			}
			curl_multi_remove_handle( $mh, $ch );
			curl_close( $ch );
		}
		curl_multi_close( $mh );
		$pending = $next;
	}
	return $out;
}

/** Fetch with retry — a flaky network must not change a store's score. */
function ars_fetch( $url, $timeout = 8, $retries = 1 ) {
	for ( $i = 0; $i <= $retries; $i++ ) {
		$res = ars_fetch_all( array( $url ), $timeout );
		if ( $res[0] ) {
			return $res[0];
		}
		if ( $i < $retries ) {
			usleep( 500000 );
		}
	}
	return null;
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

/** Decoded JSON object/array of a 200 response, or null. */
function ars_json_of( $res ) {
	if ( ! $res || 200 !== $res['status'] || ars_is_html_doc( $res['text'] ) ) {
		return null;
	}
	$j = json_decode( $res['text'], true );
	return is_array( $j ) && $j ? $j : null;
}

/* ---------- robots.txt ---------- */

/** Agents that shop / answer on a user's behalf. Training-only crawlers are deliberately not here. */
const ARS_AGENT_BOTS = array( 'oai-searchbot', 'chatgpt-user', 'gptbot', 'claudebot', 'claude-user', 'perplexitybot' );

/** Parse robots.txt into groups: [ 'agents' => string[], 'rules' => [ [allow(bool), path], … ] ]. */
function ars_robots_groups( $text ) {
	$groups   = array();
	$cur      = null;
	$in_rules = false;
	foreach ( preg_split( '/\r\n|\r|\n/', (string) $text ) as $line ) {
		$line = trim( preg_replace( '/#.*$/', '', $line ) );
		if ( ! preg_match( '/^([a-z\-]+)\s*:\s*(.*)$/i', $line, $m ) ) {
			continue;
		}
		$key = strtolower( $m[1] );
		$val = trim( $m[2] );
		if ( 'user-agent' === $key ) {
			if ( null === $cur || $in_rules ) {
				$groups[] = array( 'agents' => array(), 'rules' => array() );
				$cur      = count( $groups ) - 1;
				$in_rules = false;
			}
			$groups[ $cur ]['agents'][] = strtolower( $val );
		} elseif ( ( 'allow' === $key || 'disallow' === $key ) && null !== $cur ) {
			$in_rules                  = true;
			$groups[ $cur ]['rules'][] = array( 'allow' === $key, $val );
		} elseif ( null !== $cur ) {
			$in_rules = true; // crawl-delay etc. also end the user-agent run
		}
	}
	return $groups;
}

/**
 * May $bot fetch the site root? Returns [ allowed, named ] where "named" says
 * the file addresses this bot explicitly rather than through "*".
 */
function ars_robots_root( array $groups, $bot ) {
	$rules = array();
	$named = false;
	foreach ( $groups as $g ) {
		if ( in_array( $bot, $g['agents'], true ) ) {
			$named = true;
			$rules = array_merge( $rules, $g['rules'] );
		}
	}
	if ( ! $named ) {
		foreach ( $groups as $g ) {
			if ( in_array( '*', $g['agents'], true ) ) {
				$rules = array_merge( $rules, $g['rules'] );
			}
		}
	}
	// Only patterns that match the path "/" matter; longest wins, Allow wins a tie.
	$allowed = true;
	$best    = -1;
	foreach ( $rules as $rule ) {
		list( $allow, $path ) = $rule;
		if ( '' === $path || ! in_array( rtrim( $path, '*$' ), array( '/', '' ), true ) ) {
			continue;
		}
		$len = strlen( $path );
		if ( $len > $best || ( $len === $best && $allow ) ) {
			$best    = $len;
			$allowed = $allow;
		}
	}
	return array( $allowed, $named );
}

/** Score the AI-agent policy of a robots.txt body (0..15). */
function ars_score_robots( $text ) {
	$groups  = ars_robots_groups( $text );
	$blocked = 0;
	$named   = 0;
	foreach ( ARS_AGENT_BOTS as $bot ) {
		list( $allowed, $is_named ) = ars_robots_root( $groups, $bot );
		$blocked += $allowed ? 0 : 1;
		$named   += $is_named && $allowed ? 1 : 0;
	}
	if ( $blocked === count( ARS_AGENT_BOTS ) ) {
		return array( 'score' => 0, 'pass' => false );  // every agent is locked out
	}
	if ( $blocked > 0 ) {
		return array( 'score' => 4, 'pass' => false );  // some agents are locked out
	}
	if ( $named > 0 ) {
		return array( 'score' => 15, 'pass' => true );  // agents are explicitly welcomed
	}
	return array( 'score' => 8, 'pass' => false );      // not blocked, but no intentional policy
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
		$res  = ars_fetch( $child, 8, 1 );
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

function ars_audit_file( $domain ) {
	$dir = ars_data_dir() . '/audits';
	if ( ! is_dir( $dir ) ) {
		@mkdir( $dir, 0755, true );
	}
	return $dir . '/' . md5( ars_normalize_domain( $domain ) ) . '.json';
}

/** Last stored audit for a domain ( + 't' = unix time it ran ), or null. */
function ars_stored_audit( $domain ) {
	$file = ars_audit_file( $domain );
	if ( ! is_file( $file ) ) {
		return null;
	}
	$data = json_decode( (string) @file_get_contents( $file ), true );
	return is_array( $data ) && isset( $data['total'], $data['t'] ) ? $data : null;
}

/** Does a store qualify for the certificate? Decided only from a live audit. */
function ars_is_certified( $audit ) {
	return is_array( $audit ) && ! empty( $audit['pluginDetected'] ) && (int) $audit['total'] >= 60;
}

/**
 * Live audit of a store. Throws InvalidArgumentException for unusable targets
 * and ARS_Rate_Limited when the caller has run too many fresh audits.
 */
function ars_run_audit( $target ) {
	$target = trim( (string) $target );
	if ( ! preg_match( '#^https?://#i', $target ) ) {
		$target = 'https://' . $target;
	}
	$requested = ars_origin( $target );
	if ( ! $requested || strlen( $requested ) > 260 ) {
		throw new InvalidArgumentException( 'Invalid URL' );
	}

	$stored = ars_stored_audit( $requested );
	if ( $stored && time() - $stored['t'] < ARS_AUDIT_TTL ) {
		return $stored;
	}

	if ( ! ars_url_target( $requested . '/' ) ) {
		throw new InvalidArgumentException( 'Host is not reachable' );
	}
	// Only fresh audits cost outbound requests, so only they are rate limited.
	if ( ! ars_rate_ok( 'ip:' . ars_client_ip(), ARS_RATE_IP, 600 ) || ! ars_rate_ok( 'all', ARS_RATE_ALL, 3600 ) ) {
		throw new ARS_Rate_Limited( 'Too many audits. Try again in a few minutes.' );
	}

	$platform        = 'Unknown / Custom Solution';
	$is_woo          = false;
	$plugin_detected = false;
	// Platform-agnostic AIO rubric (100).
	$s = array(
		'robots' => array( 'score' => 0, 'pass' => false ), // 15 — AI agent access policy
		'schema' => array( 'score' => 0, 'pass' => false ), // 20 — Schema.org structured data
		'llms'   => array( 'score' => 0, 'pass' => false ), // 15 — llms.txt
		'feed'   => array( 'score' => 0, 'pass' => false ), // 15 — product feed / sitemap
		'api'    => array( 'score' => 0, 'pass' => false ), // 15 — structured product API
		'agent'  => array( 'score' => 0, 'pass' => false ), // 20 — agent-commerce layer (any vendor)
	);

	// 1) Homepage first; its FINAL origin anchors every other probe.
	$blocked = false;
	$origin  = $requested;
	$home    = ars_fetch( $requested . '/', 10, 1 );
	if ( $home ) {
		$final = ars_origin( $home['finalUrl'] );
		if ( $final && ars_url_target( $final . '/' ) ) {
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

	// robots.txt — must actually BE a robots file, not an HTML fallback. The
	// policy is evaluated per agent: naming GPTBot in a Disallow earns nothing.
	$s['robots'] = array( 'score' => 8, 'pass' => false ); // no file: nothing blocked, nothing intentional
	if ( $r['rob'] && $r['rob']['ok'] && ! ars_is_html_doc( $r['rob']['text'] ) ) {
		$s['robots'] = ars_score_robots( $r['rob']['text'] );
	}

	// llms.txt — 200 + genuinely text.
	if ( $r['llm'] && 200 === $r['llm']['status'] && ! ars_is_html_doc( $r['llm']['text'] ) && strlen( trim( $r['llm']['text'] ) ) > 40 ) {
		$s['llms'] = array( 'score' => 15, 'pass' => true );
	}

	$pj            = ars_json_of( $r['pj'] );
	$pj_valid      = $pj && isset( $pj['products'] ) && is_array( $pj['products'] ) && count( $pj['products'] ) > 0;
	$feed_valid    = $r['feed'] && 200 === $r['feed']['status'] && ars_is_xml_of( $r['feed']['text'], '/<(rss|feed)[\s>]/i' );
	$sitemap_valid = $r['sitemap'] && 200 === $r['sitemap']['status'] && ars_is_xml_of( $r['sitemap']['text'], '/<(urlset|sitemapindex)[\s>]/i' );

	// Agent-commerce layer. A manifest is a CLAIM; it only counts once the
	// product API it points to answers on the same host with real product data.
	$man         = ars_json_of( $r['man'] );
	$man_api     = false; // the manifest's product API works
	$man_catalog = false; // … and lists at least one product
	if ( $man && isset( $man['endpoints']['products'] ) && is_string( $man['endpoints']['products'] ) ) {
		$api_url = $man['endpoints']['products'];
		if ( parse_url( $api_url, PHP_URL_HOST ) === parse_url( $origin, PHP_URL_HOST ) ) {
			$api_url .= ( false === strpos( $api_url, '?' ) ? '?' : '&' ) . 'per_page=1';
			$list     = ars_json_of( ars_fetch( $api_url, 8, 1 ) );
			if ( $list && isset( $list['products'] ) && is_array( $list['products'] ) ) {
				$man_api     = true;
				$man_catalog = count( $list['products'] ) > 0;
			}
		}
	}
	$plugin_detected = $man_api && isset( $man['generator'] ) && is_string( $man['generator'] ) && 0 === strpos( $man['generator'], 'agent-ready-shop/' );

	if ( $feed_valid || $pj_valid || $man_catalog ) {
		$s['feed'] = array( 'score' => 15, 'pass' => true );
	} elseif ( $sitemap_valid ) {
		$s['feed'] = array( 'score' => 10, 'pass' => false ); // discovery only
	}

	if ( $pj_valid || $man_api || ars_json_of( $r['aip'] ) ) {
		$s['api'] = array( 'score' => 15, 'pass' => true );
	}

	// Vendor-neutral: a verified manifest, ACP or MCP discovery all earn the full 20.
	if ( $man_api || ars_json_of( $r['acp'] ) || ars_json_of( $r['mcp'] ) ) {
		$s['agent'] = array( 'score' => 20, 'pass' => true );
	}

	// 3) Homepage rarely carries Product schema — audit a real product page from the sitemap.
	$product_page = null;
	if ( ! $s['schema']['pass'] && $sitemap_valid ) {
		$product_page = ars_find_product_url( $r['sitemap']['text'] );
		$pp           = $product_page ? ars_fetch( $product_page, 10, 1 ) : null;
		if ( $pp && $pp['ok'] ) {
			$ph = strtolower( $pp['text'] );
			if ( ars_looks_like_product_schema( $ph ) ) {
				$s['schema'] = array( 'score' => 20, 'pass' => true );
			} elseif ( false !== strpos( $ph, 'application/ld+json' ) && $s['schema']['score'] < 14 ) {
				$s['schema'] = array( 'score' => 14, 'pass' => false );
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
		't'              => time(),
	);
	$json = json_encode( $data );
	@file_put_contents( ars_audit_file( $requested ), $json, LOCK_EX );
	if ( ars_audit_file( $origin ) !== ars_audit_file( $requested ) ) {
		@file_put_contents( ars_audit_file( $origin ), $json, LOCK_EX );
	}
	return $data;
}

/**
 * Audit to show on a badge: the stored one, refreshed live when it is older
 * than a day. Never blocks on more than one refresh per domain at a time.
 */
function ars_badge_audit( $domain ) {
	$domain = ars_normalize_domain( $domain );
	if ( '' === $domain || ! preg_match( '/^[a-z0-9.\-]{3,253}$/', $domain ) ) {
		return null;
	}
	$stored = ars_stored_audit( $domain );
	if ( $stored && time() - $stored['t'] < ARS_BADGE_TTL ) {
		return $stored;
	}
	$lock = ars_audit_file( $domain ) . '.lock';
	if ( ! function_exists( 'curl_init' ) || ( is_file( $lock ) && time() - filemtime( $lock ) < 120 ) ) {
		return $stored;
	}
	@touch( $lock );
	try {
		$stored = ars_run_audit( $domain );
	} catch ( Throwable $e ) {
		// keep whatever we had; an unreachable or rate-limited refresh never upgrades a badge
		$stored = $stored && time() - $stored['t'] < 7 * ARS_BADGE_TTL ? $stored : null;
	}
	@unlink( $lock );
	return $stored;
}
