<?php
/**
 * Public certificate verification — LIVE re-audit: verify.php?d=store.com
 *
 * Validity is decided only by the audit this server runs now. The certificate
 * ID is a reference label derived from the domain; it is not a secret and
 * proves nothing by itself, so it is not required.
 */
require __DIR__ . '/lib.php';

$domain  = ars_normalize_domain( isset( $_GET['d'] ) ? (string) $_GET['d'] : '' );
$well    = '' !== $domain && (bool) preg_match( '/^[a-z0-9.\-]{3,253}$/', $domain );
$live    = null;
$limited = false;
if ( $well && function_exists( 'curl_init' ) ) {
	@set_time_limit( 90 );
	try {
		$live = ars_run_audit( $domain );
	} catch ( ARS_Rate_Limited $e ) {
		$limited = true;
	} catch ( Throwable $e ) {
		$live = null;
	}
}

$detected = $live && $live['pluginDetected'];
$score    = $live ? (int) $live['total'] : 0;
$valid    = ars_is_certified( $live );
$tier     = ars_tier( $score );
$d        = ars_esc( $domain );
$id       = $well ? ars_cert_id( $domain ) : '';

if ( ! $well ) {
	$reason = 'No valid store domain was given.';
} elseif ( $limited ) {
	$reason = 'Too many verifications from your network right now. Please try again in a few minutes.';
} elseif ( ! $live ) {
	$reason = "We could not reach {$d} to audit it.";
} elseif ( ! $detected ) {
	$reason = "We re-audited {$d} live but did not find a working Agent Ready Shop agent API on it.";
} else {
	$reason = "{$d} scored {$score}/100 — below the certification threshold of 60.";
}

header( 'Content-Type: text/html; charset=utf-8' );
header( 'Cache-Control: no-store' );
?>
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Agent Ready — Verification of <?php echo $d; ?></title>
<meta name="robots" content="noindex">
<style>
  body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f0f0f1;color:#1d2327;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border:1px solid #c3c4c7;border-radius:10px;max-width:540px;width:100%;padding:32px;box-shadow:0 4px 16px rgba(0,0,0,.06)}
  .status{display:inline-flex;align-items:center;gap:8px;font-weight:700;padding:6px 12px;border-radius:6px;font-size:13px}
  .ok{background:#edfaef;color:#007017;border:1px solid #c6e1c6}.bad{background:#fcf0f1;color:#d63638;border:1px solid #f8c4c6}
  h1{font-size:22px;margin:16px 0 4px}.muted{color:#50575e;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}td{padding:9px 0;border-bottom:1px solid #f0f0f1}
  td:first-child{color:#50575e}td:last-child{text-align:right;font-weight:600}code{font-family:monospace}.live{margin-top:14px;font-size:12px;color:#8c8f94}
</style></head><body><div class="card">
  <span class="status <?php echo $valid ? 'ok' : 'bad'; ?>"><?php echo $valid ? '✓ Valid — verified live' : '✗ Not verified'; ?></span>
  <h1>Agent Ready <?php echo $valid ? ( 'gold' === $tier ? 'Certified' : 'Verified' ) : 'Verification'; ?></h1>
  <p class="muted"><?php echo $valid ? "We audited <strong>{$d}</strong> live and confirmed it meets the Agent Ready Shop standard." : $reason; ?></p>
<?php if ( $valid ) : ?>
  <div style="margin-top:22px"><?php echo ars_badge_svg( $domain, $score, 'dark', true ); ?></div>
  <table>
    <tr><td>Reference ID</td><td><code><?php echo ars_esc( $id ); ?></code></td></tr>
    <tr><td>Domain</td><td><?php echo $d; ?></td></tr>
    <tr><td>Level</td><td><?php echo ars_esc( ars_tier_label( $tier ) ); ?></td></tr>
    <tr><td>Live AIO score</td><td><?php echo $score; ?> / 100</td></tr>
    <tr><td>Platform</td><td><?php echo ars_esc( $live['platform'] ); ?></td></tr>
    <tr><td>Audited</td><td><?php echo gmdate( 'Y-m-d H:i', (int) $live['t'] ); ?> UTC</td></tr>
  </table>
  <p class="live">The score and status on this page come from an audit our server ran against the live store, not from the badge or its link.</p>
<?php endif; ?>
  <p class="muted" style="margin-top:22px">Powered by <strong>Agent Ready Shop</strong>.</p>
</div></body></html>
