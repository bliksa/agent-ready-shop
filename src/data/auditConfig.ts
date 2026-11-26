import { AuditResult, AuditCheck } from '../types';
import { withBase } from '../utils/base';

export const baseChecks: AuditCheck[] = [
  {
    id: 'robots',
    name: 'AI crawler policy',
    description: 'Whether robots.txt gives AI agents (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) a clear, intentional policy instead of an accidental block or silence.',
    category: 'critical',
    maxScore: 15,
    score: 0,
    passed: false,
    pluginFix: 'free',
    howToFix: 'Set an explicit AI-crawler policy — welcome shopping agents, block training-only bots. The plugin writes and maintains these rules for you.'
  },
  {
    id: 'schema',
    name: 'Product structured data',
    description: 'Schema.org Product / Offer JSON-LD with price, availability and GTIN. This is what agents parse to understand and compare your products.',
    category: 'semantic',
    maxScore: 20,
    score: 0,
    passed: false,
    pluginFix: 'free',
    howToFix: 'Emit clean, complete Product JSON-LD (with returns & shipping) on every product page. The plugin outputs it and removes duplicates from SEO plugins.'
  },
  {
    id: 'llms',
    name: 'llms.txt manifest',
    description: 'A Markdown map at /llms.txt — the context document LLMs read first to understand your store, categories and policies before citing or buying.',
    category: 'semantic',
    maxScore: 15,
    score: 0,
    passed: false,
    pluginFix: 'free',
    howToFix: 'Generate and auto-sync /llms.txt from your catalog and policies. The plugin builds it from your live store — no manual upkeep.'
  },
  {
    id: 'feed',
    name: 'Machine-readable product feed',
    description: 'A structured feed or sitemap agents can enumerate — so they discover every product deterministically instead of guessing from HTML.',
    category: 'transactional',
    maxScore: 15,
    score: 0,
    passed: false,
    pluginFix: 'free',
    howToFix: 'Publish a normalized JSON feed plus a Google/XML product feed, cached and auto-refreshed when products change. Served by the plugin.'
  },
  {
    id: 'api',
    name: 'Structured product API',
    description: 'A machine-readable API + discovery document agents can call for live price, stock and details — instead of brittle, slow screen-scraping.',
    category: 'transactional',
    maxScore: 15,
    score: 0,
    passed: false,
    pluginFix: 'free',
    howToFix: 'Expose a normalized products/manifest/OpenAPI at a discoverable path. The plugin adds it at /wp-json/agent-shop/v1 and /.well-known/agent-shop.json.'
  },
  {
    id: 'agent',
    name: 'Deterministic agent-commerce layer',
    description: 'The transactional layer agents need to actually buy: a discoverable manifest, an agent cart/checkout, and verified-bot handling. Effectively non-existent on stores without a purpose-built plugin today.',
    category: 'transactional',
    maxScore: 20,
    score: 0,
    passed: false,
    pluginFix: 'free',
    howToFix: 'Install Agent Ready Shop: it adds the manifest, the agent commerce API, agentic checkout (Pro) and verified-bot handling — the part standards do not cover yet.'
  }
];

export async function runSimulatedAudit(url: string, onProgress?: (msg: string) => void): Promise<AuditResult> {
  const messages = [
    'Initializing agentic browsing session…',
    'Live connection & platform detection…',
    'Reading AI crawler policy (robots.txt)…',
    'Parsing Schema.org structured data…',
    'Fetching /llms.txt context…',
    'Checking product feeds & sitemaps…',
    'Probing structured product API / discovery…',
    'Evaluating the agent-commerce layer…',
    'Calculating AIO (AI Optimization) score…'
  ];

  let detectedPlatform = 'Unknown';
  let isWoo = false;
  let pluginDetected = false;
  let botBlocked = false;
  let productPage: string | null = null;

  const checks = JSON.parse(JSON.stringify(baseChecks)) as AuditCheck[];
  const set = (id: string, score: number, pass: boolean) => {
    const c = checks.find(x => x.id === id);
    if (c) { c.score = score; c.passed = pass; }
  };

  try {
    if (onProgress) onProgress(messages[0]);
    await new Promise(r => setTimeout(r, 400));
    if (onProgress) onProgress(messages[1]);

    const res = await fetch(withBase(`/api/run-audit?url=${encodeURIComponent(url)}`));
    if (res.ok) {
      const data = await res.json();
      detectedPlatform = data.platform || 'Unknown platform';
      isWoo = !!data.isWooCommerce;
      pluginDetected = !!data.pluginDetected;
      botBlocked = !!data.blocked;
      productPage = data.productPage || null;

      if (data.scores) {
        for (const id of ['robots', 'schema', 'llms', 'feed', 'api', 'agent']) {
          if (data.scores[id]) set(id, data.scores[id].score || 0, !!data.scores[id].pass);
        }
      }
    } else {
      detectedPlatform = 'API Error';
    }
  } catch (err) {
    console.error('Server fetch failed', err);
    detectedPlatform = 'Connection Error';
  }

  for (let i = 2; i < messages.length; i++) {
    if (onProgress) onProgress(messages[i]);
    await new Promise(r => setTimeout(r, 350));
  }

  return {
    url,
    platform: detectedPlatform,
    isWooCommerce: isWoo,
    pluginDetected,
    botBlocked,
    productPage,
    totalScore: checks.reduce((acc, curr) => acc + curr.score, 0),
    checks
  };
}
