/**
 * All user-facing copy in one place. The site is English only; components read
 * strings through useT() so the copy stays out of the markup.
 */

export type Lang = 'en';

const en = {
  nav: { directory: 'Directory', plugin: 'Plugin demo', newAudit: 'New audit', language: 'Language', home: 'Agent Ready Shop — home' },
  common: { copy: 'Copy', copied: 'Copied', back: 'Back', backToAudit: 'Back to audit', getPlugin: 'Get the plugin — free', points: 'pts' },
  hero: {
    title: 'Can AI agents buy from your store?',
    leadA: 'AI shopping agents don’t click through your site — they read its files, feeds and APIs. Enter your store to see what they can ',
    leadHi: 'read, price and buy',
    leadB: '.',
    urlLabel: 'Store address',
    placeholder: 'your-store.com',
    start: 'Start audit',
    credit: 'Claudia by anabology · claudia.gallery',
  },
  errors: {
    title: 'Audit failed',
    rate: 'Too many audits from your network. Please try again in a few minutes.',
    invalid: 'This address can’t be audited. Enter the public domain of an online store, for example your-store.com.',
    server: 'The audit could not be completed right now. Please try again in a moment.',
    network: 'We couldn’t reach the audit service. Check your connection and try again.',
  },
  checksSection: { title: 'What we check' },
  features: {
    title: 'What the plugin adds',
    items: [
      { title: 'Readable', desc: 'It writes llms.txt, Product schema and your AI-crawler rules.' },
      { title: 'Queryable', desc: 'It serves a product feed and an API with live price and stock.' },
      { title: 'Buyable', desc: 'On Pro, agents price a basket and create an order that is ready to pay.' },
    ],
    note: 'The plugin is for WooCommerce. The audit works on any store.',
  },
  scan: {
    title: 'Scanning store',
    target: 'target',
    steps: [
      'Connecting to the store…',
      'Detecting the platform…',
      'Reading the AI crawler policy (robots.txt)…',
      'Parsing Schema.org structured data…',
      'Fetching /llms.txt…',
      'Checking product feeds and sitemaps…',
      'Probing the product API and discovery files…',
      'Evaluating the agent-commerce layer…',
      'Calculating the AIO score…',
    ],
  },
  results: {
    platform: 'Detected platform',
    pluginActive: 'Plugin active',
    compatible: 'Plugin compatible',
    scoreLabel: 'score',
    headline: { gold: 'Your store is agent ready', blue: 'Partially agent-ready', critical: 'Your store is invisible to AI' },
    subline: {
      gold: 'Agents can read your catalogue and transact. Claim your certificate and show the trust badge.',
      blue: 'Agents can read your store, but buying is not fully deterministic yet. Close the gaps below to get certified.',
      critical: 'Autonomous agents cannot reliably find your store or complete a purchase. Here is exactly what is missing.',
    },
    viewBadge: 'View your badge',
    previewBadge: 'Preview the badge',
    share: 'Share report',
    linkCopied: 'Link copied',
    blockedTitle: 'Your edge firewall challenges AI agents',
    blockedBody: 'Our auditor was blocked or served a bot challenge — real shopping agents get the same treatment. Even a perfect agent layer is useless behind a wall: allow verified AI agents (GPTBot, ClaudeBot, PerplexityBot) in your WAF/CDN, then run this audit again.',
    gapsTitle: (n: number) => (n === 0 ? 'No gaps found' : 'What agents can’t do yet'),
    pass: 'pass',
    fail: 'fail',
    partial: 'partial',
    fixLabel: 'Fix',
    solid: 'Already solid',
    fixEyebrow: 'The fix',
    fixTitle: 'One plugin closes these gaps',
    fixBody: 'A free WordPress plugin for WooCommerce. It publishes llms.txt, Product schema, a product feed and an API, and sets your AI-crawler rules. Pro adds agent checkout and the certificate.',
    plansTitle: 'Free gets you found. Pro gets you bought.',
    plansEyebrow: 'Plans',
  },
  pricing: {
    free: 'Free', pro: 'Pro',
    freeTitle: 'Get discovered', freeSub: 'Agents can find, read and cite your store.',
    proTitle: 'Get bought', proSub: 'Agents transact, you measure it, shoppers trust it.',
    perYear: '/ year',
    freeList: ['AI crawler access', 'llms.txt manifest', 'Basic Product schema', 'Read-only product API'],
    proList: ['Agentic checkout (cart & order API)', 'Advanced AI analytics + export', 'Enriched schema + full Google/XML feed', 'Certificate + trust badge'],
    upgrade: 'Upgrade to Pro',
  },
  buy: {
    title: 'Agent Ready Shop Pro',
    sub: 'Unlocks agentic checkout, advanced analytics, enriched schema, the full feed and your certificate.',
    perYearStore: '/ year · 1 store',
    notOnSale: 'Pro is not on sale yet',
    notOnSaleBody: 'Online payment is not available at the moment, so no licence can be bought here. The free plugin is fully usable today and takes a Pro licence key later without reinstalling.',
    demoTag: 'Demo',
    demoButton: 'Run demo purchase',
    demoNote: 'Demo mode — no payment is taken. This development build issues a test licence key so the activation flow can be tried out.',
    demoFailed: 'The demo licence could not be issued. Is the signing key configured on the server?',
    processing: 'Processing…',
    done: 'Demo purchase complete — your test licence key',
    steps: [
      'Install the Agent Ready Shop plugin on your WooCommerce store.',
      'Go to WP Admin → Agent Shop → License.',
      'Paste the key above and click Activate.',
      'Pro features switch on and the trust badge can be shown.',
    ],
  },
  cert: {
    tier: { gold: 'Certified · Agent-Transacting', blue: 'Verified · Agent-Readable', none: 'Not yet certified' },
    title: { gold: 'Agent Ready Certified', blue: 'Agent Ready Verified', none: 'Agent Ready Certificate' },
    body: {
      gold: (d: string) => `${d} meets the Agent Ready Shop standard for AI-agent commerce: agents can read the catalogue and complete a purchase.`,
      blue: (d: string) => `${d} is readable by AI agents, but the purchase path is not fully deterministic yet.`,
      none: (d: string) => `${d} does not meet the Agent Ready Shop standard yet. This is how the badge will look once it does.`,
    },
    refId: 'Reference ID',
    audited: 'Audited',
    scoreLabel: 'score',
    preview: 'This is a preview. Activate an Agent Ready Shop Pro licence in the plugin to show the badge on your store.',
    badge: 'Trust badge',
    dark: 'Dark', light: 'Light', verify: 'Verify',
    embed: 'Embed on your store',
    html: 'HTML (any site)',
    shortcode: 'WordPress shortcode (plugin)',
    note: 'The badge links to a public verification page. It is verified by a live re-audit each time the verification page is opened — the score always comes from the audit, never from the link.',
  },
  dir: {
    tag: 'Agent Ready Certified',
    title: 'The certified store registry',
    sub: 'Stores whose Agent Ready status is confirmed by a live audit. None yet.',
    cta: 'Get the plugin',
    wildTitle: 'Found in the wild',
    wildSub: 'Scores our analyzer measured on real stores in July 2026. Re-run any audit for today’s result.',
    filter: 'Filter stores or platforms…',
    store: 'Store', platform: 'Platform', passing: 'Passing',
    rerun: 'Re-run this audit live',
    gold: 'Gold', verified: 'Verified-grade',
    noMatch: (q: string) => `No stores match “${q}”.`,
  },
};

export type Dict = typeof en;

const I18N = { lang: 'en' as Lang, t: en };

export const useT = () => I18N;
