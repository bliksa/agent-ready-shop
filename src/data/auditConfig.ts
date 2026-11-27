import { AuditResult, AuditCheck, CheckId } from '../types';
import { withBase } from '../utils/base';
import type { Lang } from '../i18n';

export const CHECK_IDS: CheckId[] = ['robots', 'schema', 'llms', 'feed', 'api', 'agent'];

/** The rubric (100 points). Scores come from the server; nothing here is ever invented client-side. */
export const baseChecks: AuditCheck[] = [
  { id: 'robots', category: 'critical', maxScore: 15, score: 0, passed: false, pluginFix: 'free' },
  { id: 'schema', category: 'semantic', maxScore: 20, score: 0, passed: false, pluginFix: 'free' },
  { id: 'llms', category: 'semantic', maxScore: 15, score: 0, passed: false, pluginFix: 'free' },
  { id: 'feed', category: 'transactional', maxScore: 15, score: 0, passed: false, pluginFix: 'free' },
  { id: 'api', category: 'transactional', maxScore: 15, score: 0, passed: false, pluginFix: 'free' },
  { id: 'agent', category: 'transactional', maxScore: 20, score: 0, passed: false, pluginFix: 'free' },
];

export interface CheckCopy {
  /** Full name of the check. */
  name: string;
  /** Short machine-style label used in annotations and tables. */
  short: string;
  /** The thing itself as a noun phrase, for the one-line summary of a result ("Missing: …"). */
  thing: string;
  description: string;
  /** Plain-language consequence when the check fails. */
  flaw: string;
  howToFix: string;
}

const AGENTS = 'OAI-SearchBot, ChatGPT-User, GPTBot, ClaudeBot, Claude-User, PerplexityBot';

const CHECK_COPY: Record<Lang, Record<CheckId, CheckCopy>> = {
  en: {
    robots: {
      name: 'AI crawler policy',
      short: 'robots.txt',
      thing: 'a clear AI-crawler policy',
      description: 'Whether robots.txt lets shopping and answer agents fetch your store.',
      flaw: 'agents may be blocked or silently ignored',
      howToFix: 'Set an explicit AI-crawler policy: let shopping and answer agents in, keep training-only bots out. The plugin writes and maintains these rules for you.',
    },
    schema: {
      name: 'Product structured data',
      short: 'schema.org',
      thing: 'product structured data',
      description: 'Product and Offer JSON-LD with price and availability — what agents parse to compare products.',
      flaw: 'agents can’t read your product details',
      howToFix: 'Output clean, complete Product JSON-LD (including returns and shipping) on every product page. The plugin generates it and removes duplicates from SEO plugins.',
    },
    llms: {
      name: 'llms.txt manifest',
      short: 'llms.txt',
      thing: 'an llms.txt file',
      description: 'A Markdown map at /llms.txt that tells language models what your store sells.',
      flaw: 'no context document for language models to cite',
      howToFix: 'Generate /llms.txt from your catalogue and policies and keep it in sync. The plugin builds it from your live store — no manual upkeep.',
    },
    feed: {
      name: 'Machine-readable product feed',
      short: 'feed',
      thing: 'a product feed',
      description: 'A feed or sitemap agents can enumerate, so they find every product.',
      flaw: 'agents can’t enumerate your catalogue',
      howToFix: 'Publish a normalised JSON feed plus a Google/XML product feed, cached and refreshed whenever products change. The plugin serves both.',
    },
    api: {
      name: 'Structured product API',
      short: 'api',
      thing: 'a product API',
      description: 'An API agents call for live price and stock instead of scraping pages.',
      flaw: 'agents must scrape HTML — slow and brittle',
      howToFix: 'Expose normalised products, a manifest and an OpenAPI description at a discoverable path. The plugin adds them at /wp-json/agent-shop/v1 and /.well-known/agent-shop.json.',
    },
    agent: {
      name: 'Agent-commerce layer',
      short: 'agent layer',
      thing: 'a way for agents to check out',
      description: 'A commerce manifest, ACP or MCP endpoint agents can use to place an order.',
      flaw: 'agents have no supported way to complete a purchase',
      howToFix: 'Publish a commerce manifest or ACP / MCP discovery document for your store. On WordPress, Agent Ready Shop adds the manifest and the agent commerce API, with agentic checkout on Pro.',
    },
  },
};

export const checkCopy = (lang: Lang, id: CheckId): CheckCopy => CHECK_COPY[lang][id];

export type AuditErrorKind = 'rate' | 'invalid' | 'server' | 'network';

/** A failed audit. The UI shows a translated message per kind — never a made-up score. */
export class AuditError extends Error {
  kind: AuditErrorKind;
  constructor(kind: AuditErrorKind, detail?: string) {
    super(detail || kind);
    this.name = 'AuditError';
    this.kind = kind;
  }
}

/** Number of progress steps shown while the audit request is in flight (see t.scan.steps). */
export const AUDIT_STEPS = 9;

/**
 * Run the live audit on the server. Throws AuditError on any failure:
 * HTTP 429 → 'rate', 400 → 'invalid', other non-2xx or a malformed body → 'server',
 * no response at all → 'network'.
 */
export async function runAudit(url: string, onProgress?: (step: number) => void): Promise<AuditResult> {
  // The server probes everything in one request, so the steps are only a waiting
  // indicator: they advance on a timer and hold on the last one until it answers.
  let step = 0;
  onProgress?.(0);
  const timer = setInterval(() => {
    if (step < AUDIT_STEPS - 1) onProgress?.(++step);
  }, 900);

  try {
    let res: Response;
    try {
      res = await fetch(withBase(`/api/run-audit?url=${encodeURIComponent(url)}`));
    } catch (err) {
      throw new AuditError('network', String(err));
    }

    let data: any = null;
    try { data = await res.json(); } catch { /* non-JSON body */ }

    if (!res.ok) {
      const detail = data && typeof data.error === 'string' ? data.error : `HTTP ${res.status}`;
      throw new AuditError(res.status === 429 ? 'rate' : res.status === 400 ? 'invalid' : 'server', detail);
    }
    if (!data || typeof data.scores !== 'object' || data.scores === null) {
      throw new AuditError('server', 'Malformed audit response');
    }

    const checks: AuditCheck[] = baseChecks.map(c => {
      const s = data.scores[c.id];
      const score = Math.max(0, Math.min(c.maxScore, Number(s?.score) || 0));
      return { ...c, score, passed: !!s?.pass };
    });

    return {
      url,
      platform: typeof data.platform === 'string' && data.platform ? data.platform : '—',
      isWooCommerce: !!data.isWooCommerce,
      pluginDetected: !!data.pluginDetected,
      botBlocked: !!data.blocked,
      read: data.read !== false && !data.blocked,
      productPage: typeof data.productPage === 'string' ? data.productPage : null,
      totalScore: checks.reduce((acc, c) => acc + c.score, 0),
      checks,
    };
  } finally {
    clearInterval(timer);
  }
}
