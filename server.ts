import express from 'express';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { promises as dns } from 'dns';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';
import { buildBadgeSvg, buildCert, verifyCertId, normalizeDomain } from './src/utils/badge';
import { issueLicense } from './src/utils/license';

const APP_VERSION = '1.0.0';

const fetchOptions = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; AgentReadyShop/1.0; +https://agentreadyshop.com/bot)',
    // A plain page request: listing application/json made some stores answer the storefront URL with a JSON error.
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
};

const MAX_BODY = 3_000_000;

/* ---------- SSRF guard (mirrors static/lib.php) ---------- */

function ipIsPublic(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0)) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (!net.isIPv6(ip)) return false;
  const l = ip.toLowerCase();
  const mapped = l.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipIsPublic(mapped[1]);
  if (l === '::' || l === '::1' || l.startsWith('::ffff:') || l.startsWith('64:ff9b:')) return false;
  if (/^f[cd]/.test(l) || /^fe[89ab]/.test(l) || l.startsWith('ff')) return false; // ULA, link-local, multicast
  return true;
}

/** http(s), default port, and every address the host resolves to is public.
 *  Note: unlike the PHP build this cannot pin the connection to the checked
 *  address, so run the Node server behind an egress firewall in production. */
async function urlIsSafe(url: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.port || u.username || u.password) return false;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return ipIsPublic(host);
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && addrs.every(a => ipIsPublic(a.address));
  } catch { return false; }
}

interface FetchOut { status: number; ok: boolean; text: string; ct: string; finalUrl: string; }

/** Fetch with retry — a flaky network must not change a store's score.
 *  Redirects are followed by hand so the target of every hop is re-validated. */
async function fetchText(url: string, timeout = 8000, retries = 1): Promise<FetchOut | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      let current = url;
      for (let hop = 0; hop <= 5; hop++) {
        if (!(await urlIsSafe(current))) return null;
        const res = await fetch(current, { ...fetchOptions, signal: AbortSignal.timeout(timeout), redirect: 'manual' });
        const loc = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
        if (loc) { current = new URL(loc, current).href; continue; }
        const text = (await res.text()).slice(0, MAX_BODY);
        return { status: res.status, ok: res.ok, text, ct: res.headers.get('content-type') || '', finalUrl: current };
      }
      return null; // redirect loop
    } catch {
      if (i < retries) await new Promise(r => setTimeout(r, 500));
    }
  }
  return null;
}

/* ---------- rate limiting (fresh audits only) ---------- */

class RateLimited extends Error {}
class BadTarget extends Error {}
const hits = new Map<string, number[]>();
function rateOk(bucket: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(bucket) || []).filter(t => t > now - windowMs);
  const ok = list.length < limit;
  if (ok) list.push(now);
  hits.set(bucket, list);
  return ok;
}

/* ---------- robots.txt (mirrors static/lib.php) ---------- */

/** Agents that shop / answer on a user's behalf. Training-only crawlers are deliberately not here. */
const AGENT_BOTS = ['oai-searchbot', 'chatgpt-user', 'gptbot', 'claudebot', 'claude-user', 'perplexitybot'];
interface RobotsGroup { agents: string[]; rules: [boolean, string][]; }

function robotsGroups(text: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let cur: RobotsGroup | null = null;
  let inRules = false;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const m = raw.replace(/#.*$/, '').trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || inRules) { cur = { agents: [], rules: [] }; groups.push(cur); inRules = false; }
      cur.agents.push(val.toLowerCase());
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      inRules = true;
      cur.rules.push([key === 'allow', val]);
    } else if (cur) inRules = true;
  }
  return groups;
}

function robotsRoot(groups: RobotsGroup[], bot: string): { allowed: boolean; named: boolean } {
  let own = groups.filter(g => g.agents.includes(bot));
  const named = own.length > 0;
  if (!named) own = groups.filter(g => g.agents.includes('*'));
  let allowed = true;
  let best = -1;
  for (const [allow, p] of own.flatMap(g => g.rules)) {
    if (p === '' || !['/', ''].includes(p.replace(/[*$]+$/, ''))) continue; // only patterns matching "/"
    if (p.length > best || (p.length === best && allow)) { best = p.length; allowed = allow; }
  }
  return { allowed, named };
}

export function scoreRobots(text: string): { score: number; pass: boolean } {
  const groups = robotsGroups(text);
  let blocked = 0;
  let named = 0;
  for (const bot of AGENT_BOTS) {
    const r = robotsRoot(groups, bot);
    if (!r.allowed) blocked++;
    else if (r.named) named++;
  }
  if (blocked === AGENT_BOTS.length) return { score: 0, pass: false }; // every agent is locked out
  if (blocked > 0) return { score: 4, pass: false };                   // some agents are locked out
  if (named > 0) return { score: 15, pass: true };                     // agents are explicitly welcomed
  return { score: 8, pass: false };                                    // not blocked, but no intentional policy
}

// Body validators — a 200 status is meaningless on its own: SPAs and WAFs
// answer 200 with an HTML shell for ANY path, which used to cause flaky
// false-positives (llms.txt "found" one run, missing the next).
const isHtmlDoc = (t: string) => /^\s*(<!doctype|<html|<head|<body|<script)/i.test(t.slice(0, 300));
const isXmlOf = (t: string, tag: RegExp) => tag.test(t.slice(0, 4000));
/** Parsed JSON object/array of a 200 response, or null. */
function jsonOf(res: FetchOut | null): any | null {
  if (!res || res.status !== 200 || isHtmlDoc(res.text)) return null;
  try { const j = JSON.parse(res.text); return j && typeof j === 'object' && Object.keys(j).length ? j : null; } catch { return null; }
}

interface AuditData {
  origin: string;
  platform: string;
  isWooCommerce: boolean;
  pluginDetected: boolean;
  blocked: boolean; // edge WAF / anti-bot challenged our auditor
  read: boolean; // false when the storefront itself could not be read; the scores then say nothing about the store
  productPage: string | null; // deep product URL we audited (if any)
  scores: Record<string, { score: number; pass: boolean }>;
  total: number;
  t: number; // when the audit ran (ms)
}

// Audits are kept (in memory) so badges can show the last score this server
// measured itself — a score is never accepted from a URL.
const audits = new Map<string, AuditData>();
const AUDIT_TTL = 15 * 60 * 1000;
const BADGE_TTL = 24 * 60 * 60 * 1000;
const isCertified = (a: AuditData | null | undefined) => !!a && a.pluginDetected && a.total >= 60;

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
async function runAudit(targetUrl: string, clientIp = 'local'): Promise<AuditData> {
  targetUrl = targetUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;
  let requested: string;
  try { requested = new URL(targetUrl).origin; } catch { throw new BadTarget('Invalid URL'); }

  const cached = audits.get(normalizeDomain(requested));
  if (cached && Date.now() - cached.t < AUDIT_TTL) return cached;

  if (!(await urlIsSafe(requested + '/'))) throw new BadTarget('Host is not reachable');
  // Only fresh audits cost outbound requests, so only they are rate limited.
  if (!rateOk('ip:' + clientIp, 12, 10 * 60 * 1000) || !rateOk('all', 300, 60 * 60 * 1000)) {
    throw new RateLimited('Too many audits. Try again in a few minutes.');
  }

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

  // robots.txt — must actually BE a robots file, not an SPA/WAF HTML fallback. The
  // policy is evaluated per agent: naming GPTBot in a Disallow earns nothing.
  s.robots = rob && rob.ok && !isHtmlDoc(rob.text) ? scoreRobots(rob.text) : { score: 8, pass: false };

  // llms.txt — 200 + genuinely text (SPAs answer 200 with index.html for any path).
  if (llm && llm.status === 200 && !isHtmlDoc(llm.text) && llm.text.trim().length > 40) {
    s.llms = { score: 15, pass: true };
  }

  // Validated machine-readable surfaces.
  const pj = jsonOf(productsJson);
  const pjValid = !!(pj && Array.isArray(pj.products) && pj.products.length > 0);
  const feedValid = !!(ourXml && ourXml.status === 200 && isXmlOf(ourXml.text, /<(rss|feed)[\s>]/i));
  const sitemapValid = !!(sitemap && sitemap.status === 200 && isXmlOf(sitemap.text, /<(urlset|sitemapindex)[\s>]/i));

  // Agent-commerce layer. A manifest is a CLAIM; it only counts once the product
  // API it points to answers on the same host with real product data.
  const manJson = jsonOf(man);
  let manApi = false;     // the manifest's product API works
  let manCatalog = false; // … and lists at least one product
  const apiUrl = manJson?.endpoints?.products;
  if (typeof apiUrl === 'string') {
    try {
      const u = new URL(apiUrl);
      if (u.hostname === new URL(origin).hostname) {
        u.searchParams.set('per_page', '1');
        const list = jsonOf(await fetchText(u.href, 8000, 1));
        if (list && Array.isArray(list.products)) { manApi = true; manCatalog = list.products.length > 0; }
      }
    } catch { /* not a URL */ }
  }
  pluginDetected = manApi && typeof manJson.generator === 'string' && manJson.generator.startsWith('agent-ready-shop/');

  if (feedValid || pjValid || manCatalog) s.feed = { score: 15, pass: true };
  else if (sitemapValid) s.feed = { score: 10, pass: false }; // discovery only

  if (pjValid || manApi || jsonOf(aiPlugin)) s.api = { score: 15, pass: true };

  // Vendor-neutral: a verified manifest, ACP or MCP discovery all earn the full 20.
  if (manApi || jsonOf(acp) || jsonOf(mcp)) s.agent = { score: 20, pass: true };

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
  const data: AuditData = { origin, platform, isWooCommerce, pluginDetected, blocked, read: !!home && home.ok && !blocked, productPage, scores: s, total, t: Date.now() };
  audits.set(normalizeDomain(requested), data);
  audits.set(normalizeDomain(origin), data); // both spellings hit the same entry
  return data;
}

const refreshing = new Set<string>();
/** Audit to show on a badge: the stored one, refreshed live when older than a day. */
async function badgeAudit(domain: string): Promise<AuditData | null> {
  const d = normalizeDomain(domain);
  if (!/^[a-z0-9.-]{3,253}$/.test(d)) return null;
  const stored = audits.get(d) || null;
  if ((stored && Date.now() - stored.t < BADGE_TTL) || refreshing.has(d)) return stored;
  refreshing.add(d);
  try { return await runAudit(d, 'badge'); }
  catch { return stored && Date.now() - stored.t < 7 * BADGE_TTL ? stored : null; }
  finally { refreshing.delete(d); }
}

const esc = (t: string) => t.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

async function startServer() {
  const app = express();
  app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false);
  // BASE_PATH=/ashop mounts every route (API, verify, frontend) under a subdirectory.
  const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
  const router = express.Router();
  const PORT = Number(process.env.PORT) || 3000;

  // ---- Live audit ----
  const auditHandler: express.RequestHandler = async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ error: 'URL is required' });
    try {
      const a = await runAudit(targetUrl, req.ip || 'unknown');
      res.setHeader('Cache-Control', 'no-store');
      res.json({ platform: a.platform, isWooCommerce: a.isWooCommerce, pluginDetected: a.pluginDetected, blocked: a.blocked, read: a.read, productPage: a.productPage, scores: a.scores });
    } catch (e) {
      if (e instanceof BadTarget) return res.status(400).json({ error: e.message });
      if (e instanceof RateLimited) return res.status(429).setHeader('Retry-After', '300').json({ error: e.message });
      console.error('Audit error:', e);
      res.status(500).json({ error: 'Audit failed' });
    }
  };
  router.get('/api/run-audit', auditHandler);

  // ---- Badge SVG — the score comes from OUR last live audit, never from the URL ----
  const badgeHandler: express.RequestHandler = async (req, res) => {
    const domain = normalizeDomain((req.query.d as string) || '');
    const style = (req.query.style as string) === 'light' ? 'light' : 'dark';
    const audit = await badgeAudit(domain);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buildBadgeSvg({ domain: domain || 'unknown', score: audit ? audit.total : null, style, certified: isCertified(audit) }));
  };
  router.get(['/api/badge', '/badge.php'], badgeHandler);

  // ---- Public certificate verification: LIVE re-audit of the domain ----
  // Validity is decided only by the audit run now. The certificate ID is a
  // reference label derived from the domain, so it is accepted but not required.
  router.get(['/verify/:id', '/verify', '/verify.php'], async (req, res) => {
    const domain = normalizeDomain((req.query.d as string) || '');
    const well = /^[a-z0-9.-]{3,253}$/.test(domain);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    let live: AuditData | null = null;
    let limited = false;
    if (well) { try { live = await runAudit(domain, req.ip || 'unknown'); } catch (e) { limited = e instanceof RateLimited; } }

    const score = live ? live.total : 0;
    const valid = isCertified(live);
    const cert = well ? buildCert(domain, score) : null;

    let reason = '';
    if (!well) reason = 'No valid store domain was given.';
    else if (limited) reason = 'Too many verifications from your network right now. Please try again in a few minutes.';
    else if (!live) reason = `We could not reach ${domain} to audit it.`;
    else if (!live.pluginDetected) reason = `We re-audited ${domain} live but did not find a working Agent Ready Shop agent API on it.`;
    else reason = `${domain} scored ${score}/100 — below the certification threshold of 60.`;

    res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Agent Ready — Verification of ${domain}</title>
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
  <span class="status ${valid ? 'ok' : 'bad'}">${valid ? '✓ Valid — verified live' : '✗ Not verified'}</span>
  <h1>Agent Ready ${valid ? (cert!.tier === 'gold' ? 'Certified' : 'Verified') : 'Verification'}</h1>
  <p class="muted">${valid ? `We audited <strong>${domain}</strong> live and confirmed it meets the Agent Ready Shop standard.` : reason}</p>
  ${valid ? `<div style="margin-top:22px">${buildBadgeSvg({ domain: cert!.domain, score: cert!.score, style: 'dark' })}</div>
  <table>
    <tr><td>Reference ID</td><td><code>${cert!.certId}</code></td></tr>
    <tr><td>Domain</td><td>${cert!.domain}</td></tr>
    <tr><td>Level</td><td>${cert!.tierLabel}</td></tr>
    <tr><td>Live AIO score</td><td>${cert!.score} / 100</td></tr>
    <tr><td>Platform</td><td>${esc(live!.platform)}</td></tr>
    <tr><td>Audited</td><td>${new Date(live!.t).toISOString().slice(0, 16).replace('T', ' ')} UTC</td></tr>
  </table>
  <p class="live">The score and status on this page come from an audit our server ran against the live store, not from the badge or its link.</p>` : ''}
  <p class="muted" style="margin-top:22px">Powered by <strong>Agent Ready Shop</strong>.</p>
</div></body></html>`);
  });

  // ---- Product: mint a license (in production this sits behind a payment webhook) ----
  router.get('/api/license/issue', (req, res) => {
    // Demo only: this hands out a valid key without payment, so it is disabled in
    // production until it sits behind a verified payment webhook.
    if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Not available' });
    try {
      const lic = issueLicense({
        plan: (req.query.plan as string) || 'pro',
        features: (req.query.features as string) || '*',
        expires: (req.query.expires as string) || 'never',
        domain: (req.query.domain as string) || '',
      });
      res.json(lic);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Vendor: batch license generator (admin-token gated) ----
  router.get('/api/license/generate', (req, res) => {
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
        domain: (req.query.domain as string) || '',
      };
      const keys = Array.from({ length: count }, () => issueLicense(opts));
      res.json({ count, plan: opts.plan, features: opts.features, expires: opts.expires, keys });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---- Product: self-hosted update manifest for the plugin's auto-updater ----
  router.get(['/api/update/agent-ready-shop.json', '/api/update'], (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    res.json({
      version: APP_VERSION,
      download_url: `${origin}${BASE}/api/download-plugin`,
      tested: '6.6', requires: '6.0', requires_php: '7.4',
      changelog: 'See the changelog in readme.txt inside the plugin archive.',
    });
  });

  // ---- Static-build URL shape (what the plugin calls): api.php?action=… ----
  router.get('/api.php', (req, res, next) => {
    const action = String(req.query.action || '');
    if (action === 'run-audit') return auditHandler(req, res, next);
    if (action === 'update') return res.redirect(`${BASE}/api/update`);
    res.status(404).json({ error: 'Not available on this site' });
  });

  // ---- Download the real plugin (zipped from disk, without the vendor license tools) ----
  router.get(['/api/download-plugin', '/agent-ready-shop.zip'], async (_req, res) => {
    try {
      const root = path.join(process.cwd(), 'plugin', 'agent-ready-shop');
      if (!fs.existsSync(root)) return res.status(404).json({ error: 'Plugin source not found' });
      const zip = new JSZip();
      const walk = (dir: string, base: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, entry.name);
          const rel = path.posix.join(base, entry.name);
          if (entry.isDirectory()) { if (entry.name !== 'tools') walk(abs, rel); } else zip.file(rel, fs.readFileSync(abs));
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
    app.use(BASE || '/', router);
    const vite = await createViteServer({ base: BASE + '/', server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    router.use(express.static(distPath));
    router.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
    app.use(BASE || '/', router);
    if (BASE) app.get('/', (_req, res) => res.redirect(BASE + '/'));
  }

  const server = app.listen(PORT, '0.0.0.0', () => console.log(`Agent Ready Shop running on http://localhost:${PORT}${BASE}/`));
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') { console.error(`\nPort ${PORT} is already in use. Try: PORT=3001 npm run dev\n`); process.exit(1); }
    throw err;
  });
}

startServer();
