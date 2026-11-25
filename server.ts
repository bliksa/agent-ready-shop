import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { buildBadgeSvg, buildCert, verifyCertId, normalizeDomain } from './src/utils/badge';
import { issueLicense } from './src/utils/license';

const APP_VERSION = '1.0.0';

const fetchOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; AgentReadyShop/1.0; +https://agentreadyshop.com/bot)',
    'Accept': 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
};

async function safeFetch(url: string, timeout = 6000): Promise<Response | null> {
  try {
    return await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(timeout) });
  } catch {
    return null;
  }
}

interface FetchOut { status: number; ok: boolean; text: string; ct: string; finalUrl: string; }

/** Fetch with retry — a flaky network must not change a store's score. */
async function fetchText(url: string, timeout = 8000, retries = 1): Promise<FetchOut | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
      const text = await res.text();
      return { status: res.status, ok: res.ok, text, ct: res.headers.get('content-type') || '', finalUrl: res.url || url };
    } catch {
      if (i < retries) await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

// Body validators — a 200 status is meaningless on its own: SPAs and WAFs
// answer 200 with an HTML shell for ANY path, which used to cause flaky
// false-positives (llms.txt "found" one run, missing the next).
const isHtmlDoc = (t: string) => /^\s*(<!doctype|<html|<head|<body|<script)/i.test(t.slice(0, 300));
const isXmlOf = (t: string, tag: RegExp) => tag.test(t.slice(0, 4000));
function asJson(t: string): any | null { try { return JSON.parse(t); } catch { return null; } }

interface AuditData {
  origin: string;
  platform: string;
  isWooCommerce: boolean;
  pluginDetected: boolean;
  blocked: boolean; // edge WAF / anti-bot challenged our auditor
  productPage: string | null; // deep product URL we audited (if any)
  scores: Record<string, { score: number; pass: boolean }>;
  total: number;
}

const auditCache = new Map<string, { t: number; data: AuditData }>();
const AUDIT_TTL = 15 * 60 * 1000;

const BLOCK_MARKERS = /captcha|cf-chl|challenge-platform|attention required|access denied|are you a robot|just a moment|akamai|incapsula|perimeterx|datadome/i;

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map(m => m[1].trim()).filter(l => !l.endsWith('.gz'));
}

/** Find a real product URL from a sitemap (descends one index level).
 *  Deterministic: same sitemap in → same URL out (stable pick, no randomness). */
async function findProductUrl(xml: string): Promise<string | null> {
  let locs = extractLocs(xml);
  // Sitemap index → descend into the most product-looking child.
  if (locs.length && locs.every(l => /\.xml(\?|$)/i.test(l))) {
    const child = locs.find(l => /product|produkt|item|shop/i.test(l)) || locs[0];
    const res = await fetchText(child, 8000, 1);
    locs = res && res.ok ? extractLocs(res.text) : [];
  }
  const pages = locs.filter(l => !/\.xml(\?|$)/i.test(l));
  if (!pages.length) return null;
  const productLike = pages.filter(l => /\/(product|produkt|p|item|dp)\//i.test(l)).sort();
  if (productLike.length) return productLike[0];
  // Deepest-path heuristic with alphabetical tiebreak — fully deterministic.
  return pages.slice(0, 50).sort((a, b) => (b.length - a.length) || a.localeCompare(b))[0] || null;
}

function looksLikeProductSchema(html: string): boolean {
  return html.includes('"@type":"product"') || html.includes('"@type": "product"')
    || html.includes('"@type":"offer"') || html.includes('og:type" content="product') || html.includes("og:type' content='product");
}

/** Live audit of a store — shared by the analyzer and the certificate verifier.
 *  Deterministic by design: canonical origin, retried fetches, validated bodies. */
async function runAudit(targetUrl: string): Promise<AuditData> {
  if (!/^https?:\/\//.test(targetUrl)) targetUrl = 'https://' + targetUrl;
  const requested = new URL(targetUrl).origin;

  const cached = auditCache.get(requested);
  if (cached && Date.now() - cached.t < AUDIT_TTL) return cached.data;

  let platform = 'Unknown / Custom Solution';
  let isWooCommerce = false;
  let pluginDetected = false;
  // Platform-agnostic AIO rubric (100): rewards standard/emerging agent surfaces,
  // not our own endpoints. The "agent" bucket is the deterministic commerce layer
  // that today effectively requires a plugin like ours.
  const s = {
    robots: { score: 0, pass: false }, // 15 — AI crawler policy
    schema: { score: 0, pass: false }, // 20 — Schema.org structured data
    llms:   { score: 0, pass: false }, // 15 — llms.txt
    feed:   { score: 0, pass: false }, // 15 — machine-readable product feed / sitemap
    api:    { score: 0, pass: false }, // 15 — structured product API / discovery
    agent:  { score: 0, pass: false }, // 20 — deterministic agent-commerce layer
  };

  // 1) Homepage first. Its FINAL origin (after www/https redirects) anchors every
  //    other probe, so `alza.sk` and `www.alza.sk` always score identically.
  let blocked = false;
  let html = '';
  let origin = requested;
  const home = await fetchText(requested + '/', 10000, 1);
  if (home) {
    try { origin = new URL(home.finalUrl).origin; } catch { /* keep requested */ }
    if ([401, 403, 429, 503].includes(home.status)) blocked = true;
    if (home.ok) {
      html = home.text.toLowerCase();
      if (BLOCK_MARKERS.test(html) && html.length < 20000) blocked = true; // short challenge page, not a real storefront
      if (html.includes('wp-content') || html.includes('wordpress')) {
        platform = 'WordPress';
        if (html.includes('woocommerce')) { platform = 'WordPress / WooCommerce'; isWooCommerce = true; }
      } else if (html.includes('cdn.shopify.com') || html.includes('var shopify')) platform = 'Shopify';
      else if (html.includes('shoptet')) platform = 'Shoptet';
      else if (html.includes('upgates')) platform = 'Upgates';
      else if (html.includes('prestashop')) platform = 'PrestaShop';
      else if (html.includes('magento') || html.includes('mage/')) platform = 'Magento';

      if (looksLikeProductSchema(html)) s.schema = { score: 20, pass: true };
      else if (html.includes('application/ld+json')) s.schema = { score: 14, pass: false }; // structured data, not commerce-typed
    }
  }
  if (blocked) platform = platform === 'Unknown / Custom Solution' ? 'Unknown (bot-blocked)' : platform;

  // 2) Independent probes in parallel against the canonical origin.
  const [rob, llm, sitemap, ourXml, productsJson, aiPlugin, man, acp, mcp] = await Promise.all([
    fetchText(origin + '/robots.txt', 6000),
    fetchText(origin + '/llms.txt', 6000),
    fetchText(origin + '/sitemap.xml', 8000),
    fetchText(origin + '/agent-shop-feed.xml', 6000),
    fetchText(origin + '/products.json', 6000), // Shopify & similar
    fetchText(origin + '/.well-known/ai-plugin.json', 6000),
    fetchText(origin + '/.well-known/agent-shop.json', 6000),
    fetchText(origin + '/.well-known/agentic-commerce.json', 6000),
    fetchText(origin + '/.well-known/mcp.json', 6000),
  ]);

  // robots.txt — must actually BE a robots file, not an SPA/WAF HTML fallback.
  if (rob && rob.ok && !isHtmlDoc(rob.text)) {
    const t = rob.text.toLowerCase();
    if (/user-agent:\s*gptbot\s*[\r\n]+\s*disallow:\s*\/\s*$/m.test(t)) s.robots = { score: 0, pass: false }; // explicitly blocks AI
    else if (/(gptbot|claudebot|google-extended|perplexitybot)/.test(t)) s.robots = { score: 15, pass: true }; // explicit AI policy
    else s.robots = { score: 8, pass: false }; // neutral — not optimized
  } else s.robots = { score: 8, pass: false };

  // llms.txt — 200 + genuinely text (SPAs answer 200 with index.html for any path).
  if (llm && llm.status === 200 && !isHtmlDoc(llm.text) && llm.text.trim().length > 40) {
    s.llms = { score: 15, pass: true };
  }

  // Validated machine-readable surfaces.
  const pj = productsJson && productsJson.status === 200 ? asJson(productsJson.text) : null;
  const pjValid = !!(pj && Array.isArray(pj.products) && pj.products.length > 0);
  const feedValid = !!(ourXml && ourXml.status === 200 && isXmlOf(ourXml.text, /<(rss|feed)[\s>]/i));
  const sitemapValid = !!(sitemap && sitemap.status === 200 && isXmlOf(sitemap.text, /<(urlset|sitemapindex)[\s>]/i));

  if (feedValid || pjValid) s.feed = { score: 15, pass: true };
  else if (sitemapValid) s.feed = { score: 10, pass: false }; // discovery only

  // Structured product API / agent discovery — JSON must parse.
  const aiPluginValid = !!(aiPlugin && aiPlugin.status === 200 && asJson(aiPlugin.text));
  if (pjValid || aiPluginValid) s.api = { score: 15, pass: true };

  // Deterministic agent-commerce layer (our plugin / ACP / MCP discovery).
  const manJson = man && man.status === 200 ? asJson(man.text) : null;
  if (manJson && typeof manJson.generator === 'string' && manJson.generator.includes('agent')) {
    pluginDetected = true;
    s.agent = { score: 20, pass: true };
    if (!s.api.pass) s.api = { score: 15, pass: true };
    if (!s.feed.pass) s.feed = { score: 15, pass: true };
  } else {
    const acpValid = !!(acp && acp.status === 200 && asJson(acp.text));
    const mcpValid = !!(mcp && mcp.status === 200 && asJson(mcp.text));
    if (acpValid || mcpValid) s.agent = { score: 14, pass: false };
  }

  // 3) Homepage rarely carries Product schema — audit a real product page from the sitemap.
  let productPage: string | null = null;
  if (!s.schema.pass && sitemapValid) {
    productPage = await findProductUrl(sitemap!.text);
    if (productPage) {
      const pp = await fetchText(productPage, 10000, 1);
      if (pp && pp.ok) {
        const ph = pp.text.toLowerCase();
        if (looksLikeProductSchema(ph)) s.schema = { score: 20, pass: true };
        else if (ph.includes('application/ld+json') && s.schema.score < 14) s.schema = { score: 14, pass: false };
      }
    }
  }

  const total = Object.values(s).reduce((a, x) => a + x.score, 0);
  const data: AuditData = { origin, platform, isWooCommerce, pluginDetected, blocked, productPage, scores: s, total };
  auditCache.set(requested, { t: Date.now(), data });
  if (origin !== requested) auditCache.set(origin, { t: Date.now(), data }); // both spellings hit the same cache entry
  return data;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // ---- Live audit ----
  app.get('/api/run-audit', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ error: 'URL is required' });
    try {
      const a = await runAudit(targetUrl);
      res.json({ platform: a.platform, isWooCommerce: a.isWooCommerce, pluginDetected: a.pluginDetected, blocked: a.blocked, productPage: a.productPage, scores: a.scores });
    } catch (e) {
      console.error('Audit error:', e);
      res.status(500).json({ error: 'Audit failed' });
    }
  });

  // ---- Badge SVG ----
  app.get('/api/badge', (req, res) => {
    const domain = (req.query.d as string) || 'your-store.com';
    const score = Math.max(0, Math.min(100, parseInt((req.query.s as string) || '0', 10) || 0));
    const style = (req.query.style as 'dark' | 'light') === 'light' ? 'light' : 'dark';
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buildBadgeSvg({ domain, score, style }));
  });

  // ---- Public certificate verification: LIVE re-audit of the domain ----
  app.get(['/verify/:id', '/verify'], async (req, res) => {
    const id = (req.params.id || (req.query.id as string) || '').toUpperCase();
    const domain = normalizeDomain((req.query.d as string) || '');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    const structural = !!domain && verifyCertId(domain, id);
    let live: AuditData | null = null;
    if (structural) { try { live = await runAudit(domain); } catch { live = null; } }

    const detected = !!live && live.pluginDetected;
    const score = live ? live.total : 0;
    const valid = structural && detected && score >= 60;
    const cert = valid ? buildCert(domain, score) : null;

    let reason = '';
    if (!structural) reason = 'The certificate ID does not match this domain.';
    else if (!detected) reason = `We re-audited ${domain} live but did not detect an active Agent Ready Shop plugin.`;
    else if (score < 60) reason = `${domain} scored ${score}/100 — below the certification threshold.`;

    res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Agent Ready — Certificate ${id}</title>
<style>
  body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f0f0f1;color:#1d2327;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border:1px solid #c3c4c7;border-radius:10px;max-width:540px;width:100%;padding:32px;box-shadow:0 4px 16px rgba(0,0,0,.06)}
  .status{display:inline-flex;align-items:center;gap:8px;font-weight:700;padding:6px 12px;border-radius:6px;font-size:13px}
  .ok{background:#edfaef;color:#007017;border:1px solid #c6e1c6}.bad{background:#fcf0f1;color:#d63638;border:1px solid #f8c4c6}
  h1{font-size:22px;margin:16px 0 4px}.muted{color:#50575e;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}td{padding:9px 0;border-bottom:1px solid #f0f0f1}
  td:first-child{color:#50575e}td:last-child{text-align:right;font-weight:600}code{font-family:monospace}.live{margin-top:14px;font-size:12px;color:#8c8f94}
</style></head><body><div class="card">
  <span class="status ${valid ? 'ok' : 'bad'}">${valid ? '✓ Valid — verified live' : '✗ Not verified'}</span>
  <h1>Agent Ready ${valid ? (cert!.tier === 'gold' ? 'Certified' : 'Verified') : 'Verification'}</h1>
  <p class="muted">${valid ? `We re-audited <strong>${domain}</strong> just now and confirmed it meets the Agent Ready Shop standard.` : reason}</p>
  ${valid ? `<div style="margin-top:22px">${buildBadgeSvg({ domain: cert!.domain, score: cert!.score, style: 'dark' })}</div>
  <table>
    <tr><td>Certificate ID</td><td><code>${cert!.certId}</code></td></tr>
    <tr><td>Domain</td><td>${cert!.domain}</td></tr>
    <tr><td>Level</td><td>${cert!.tierLabel}</td></tr>
    <tr><td>Live AIO score</td><td>${cert!.score} / 100</td></tr>
    <tr><td>Platform</td><td>${live!.platform}</td></tr>
    <tr><td>Verified</td><td>${new Date().toISOString().slice(0, 10)}</td></tr>
  </table>
  <p class="live">Re-audited live at verification time — the badge cannot be faked by a store without the plugin.</p>` : ''}
  <p class="muted" style="margin-top:22px">Powered by <strong>Agent Ready Shop</strong>.</p>
</div></body></html>`);
  });

  // ---- Product: mint a license (in production this sits behind a payment webhook) ----
  app.get('/api/license/issue', (req, res) => {
    // TODO(production): require a verified Stripe/Lemon Squeezy payment token here.
    try {
      const lic = issueLicense({
        plan: (req.query.plan as string) || 'pro',
        features: (req.query.features as string) || '*',
        expires: (req.query.expires as string) || 'never',
      });
      res.json(lic);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Vendor: batch license generator (admin-token gated) ----
  app.get('/api/license/generate', (req, res) => {
    const need = process.env.ARS_ADMIN_TOKEN;
    const got = (req.query.token as string) || req.get('x-admin-token');
    // In production a token is required; in dev it's open for the generator UI.
    if (need && got !== need) return res.status(401).json({ error: 'Unauthorized' });
    if (!need && process.env.NODE_ENV === 'production') return res.status(503).json({ error: 'Set ARS_ADMIN_TOKEN to enable the generator.' });

    try {
      const count = Math.max(1, Math.min(100, parseInt((req.query.count as string) || '1', 10) || 1));
      const opts = {
        plan: (req.query.plan as string) || 'pro',
        features: (req.query.features as string) || '*',
        expires: (req.query.expires as string) || 'never',
      };
      const keys = Array.from({ length: count }, () => issueLicense(opts));
      res.json({ count, plan: opts.plan, features: opts.features, expires: opts.expires, keys });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Product: self-hosted update manifest for the plugin's auto-updater ----
  app.get('/api/update/agent-ready-shop.json', (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    res.json({
      version: APP_VERSION,
      download_url: `${origin}/api/download-plugin`,
      tested: '6.6', requires: '6.0', requires_php: '7.4',
      changelog: 'See agentreadyshop.com/changelog',
    });
  });

  // ---- Download the real plugin (zipped from disk) ----
  app.get('/api/download-plugin', async (_req, res) => {
    try {
      const root = path.join(process.cwd(), 'plugin', 'agent-ready-shop');
      if (!fs.existsSync(root)) return res.status(404).json({ error: 'Plugin source not found' });
      const zip = new JSZip();
      const walk = (dir: string, base: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, entry.name);
          const rel = path.posix.join(base, entry.name);
          if (entry.isDirectory()) walk(abs, rel); else zip.file(rel, fs.readFileSync(abs));
        }
      };
      walk(root, 'agent-ready-shop');
      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="agent-ready-shop.zip"');
      res.send(buf);
    } catch (e) {
      console.error('Plugin zip failed', e);
      res.status(500).json({ error: 'Could not build plugin zip' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  const server = app.listen(PORT, '0.0.0.0', () => console.log(`Agent Ready Shop running on http://localhost:${PORT}`));
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') { console.error(`\nPort ${PORT} is already in use. Try: PORT=3001 npm run dev\n`); process.exit(1); }
    throw err;
  });
}

startServer();
