// Batch-audit stores through the local analyzer API and rank them.
// Usage: node scripts/audit-batch.mjs [domain ...]   (dev server must be running)
// Writes scripts/audit-results.json for reuse (e.g. the AIO Index / directory).
import fs from 'fs';

const BASE = process.env.BASE || 'http://localhost:3000';

const DEFAULT_DOMAINS = [
  // Shopify (products.json + schema — expected to score well)
  'allbirds.com', 'gymshark.com', 'colourpop.com', 'brooklinen.com',
  'kith.com', 'ruggable.com', 'mejuri.com', 'bombas.com',
  // CZ/SK market
  'gymbeam.sk', 'dedoles.sk', 'muziker.sk', 'notino.sk', 'footshop.cz',
  // big-store baselines (WAF behaviour)
  'alza.sk', 'etsy.com', 'zalando.sk',
];

const domains = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_DOMAINS;

async function audit(d) {
  try {
    const r = await fetch(`${BASE}/api/run-audit?url=${encodeURIComponent(d)}`, { signal: AbortSignal.timeout(90000) });
    const j = await r.json();
    if (!j.scores) throw new Error(j.error || 'no scores');
    const total = Object.values(j.scores).reduce((a, v) => a + v.score, 0);
    const passed = Object.entries(j.scores).filter(([, v]) => v.pass).map(([k]) => k);
    return { domain: d, total, platform: j.platform, blocked: !!j.blocked, productPage: j.productPage || null, passed, scores: j.scores };
  } catch (e) {
    return { domain: d, total: -1, platform: 'ERROR', blocked: false, productPage: null, passed: [], error: e.message };
  }
}

// small concurrency pool
const results = [];
const queue = [...domains];
async function worker() {
  while (queue.length) {
    const d = queue.shift();
    const r = await audit(d);
    results.push(r);
    console.log(`${String(r.total).padStart(4)}  ${r.blocked ? '[BLOCKED] ' : ''}${d}  (${r.platform})  ✓${r.passed.join(',')}`);
  }
}
await Promise.all([worker(), worker(), worker()]);

results.sort((a, b) => b.total - a.total);
console.log('\n=== AIO leaderboard ===');
for (const r of results) {
  const tier = r.total >= 85 ? 'GOLD' : r.total >= 60 ? 'VERIFIED' : '—';
  console.log(`${String(r.total).padStart(4)}/100  ${tier.padEnd(9)} ${r.domain.padEnd(18)} ${r.platform}${r.blocked ? '  [bot-blocked]' : ''}`);
}

fs.writeFileSync('scripts/audit-results.json', JSON.stringify(results, null, 2));
console.log('\nSaved scripts/audit-results.json');
