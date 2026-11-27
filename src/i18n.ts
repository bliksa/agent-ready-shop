/**
 * Tiny dependency-free i18n layer: three dictionaries, a context and useT().
 * Language choice: ?lang= query param > saved choice > navigator.language > en.
 */
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export type Lang = 'en' | 'sk' | 'cs';
export const LANGS: Lang[] = ['en', 'sk', 'cs'];
const STORAGE_KEY = 'ars-lang';

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'sk' || v === 'cs';

export function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';
  const q = new URLSearchParams(window.location.search).get('lang')?.toLowerCase();
  if (isLang(q)) return q;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch { /* storage unavailable */ }
  const nav = (navigator.language || '').slice(0, 2).toLowerCase();
  return isLang(nav) ? nav : 'en';
}

const en = {
  nav: { directory: 'Directory', plugin: 'Plugin demo', newAudit: 'New audit', language: 'Language', home: 'Agent Ready Shop — home' },
  common: { copy: 'Copy', copied: 'Copied', back: 'Back', backToAudit: 'Back to audit', getPlugin: 'Get the plugin — free', points: 'pts' },
  hero: {
    eyebrow: 'AIO audit / agentic commerce',
    title: 'Can AI agents buy from your store?',
    leadA: 'Shopping is moving from people to machines. ChatGPT, Claude and Gemini don’t click through your site — they read it through files, feeds and APIs. See what an agent can and can’t do with your store, and get the fixes that let it ',
    leadHi: 'read, price and buy',
    leadB: ' your products.',
    urlLabel: 'Store address',
    placeholder: 'your-store.com',
    start: 'Start audit',
    meta: ['6 checks · 100 points', 'Live audit · no sign-up', 'Shareable report link'],
    figCaption: 'Illustration · how an agent reads a product page',
  },
  errors: {
    title: 'Audit failed',
    rate: 'Too many audits from your network. Please try again in a few minutes.',
    invalid: 'This address can’t be audited. Enter the public domain of an online store, for example your-store.com.',
    server: 'The audit could not be completed right now. Please try again in a moment.',
    network: 'We couldn’t reach the audit service. Check your connection and try again.',
  },
  checksSection: { title: 'What we check', eyebrow: 'Six signals · 100 points', max: 'max' },
  features: {
    title: 'What the plugin adds',
    eyebrow: 'One WordPress plugin',
    items: [
      { title: 'Structured commerce API', desc: 'A manifest, product API and feed that agents call for live price, stock and details — no scraping.' },
      { title: 'llms.txt & clean schema', desc: 'The context file and JSON-LD that let language models read, understand and cite your catalogue.' },
      { title: 'Agentic checkout', desc: 'Agents price a basket and create a ready-to-pay order — a real, deterministic purchase path.' },
    ],
    platformsLabel: 'A WordPress plugin · deep integration with',
    alsoAudits: 'The audit itself works for any store — Shopify, PrestaShop, Magento, Shoptet, Wix and more.',
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
    scoreLabel: 'aio score',
    level: { gold: 'Certified readiness', blue: 'Partial readiness', critical: 'Critical readiness' },
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
    gapsTitle: (n: number) => (n === 0 ? 'No gaps found' : `${n} ${n === 1 ? 'gap' : 'gaps'} agents hit today`),
    sortedByImpact: 'Sorted by impact',
    inclProductPage: 'Incl. product page',
    pass: 'pass',
    fail: 'fail',
    partial: 'partial',
    fixLabel: 'Fix',
    solid: 'Already solid',
    fixEyebrow: 'The fix',
    fixTitle: 'One plugin installs the whole agent-commerce layer',
    fixBodyA: 'Agent Ready Shop',
    fixBodyB: ' is a WordPress plugin that does the actual engineering: it writes and maintains your llms.txt, outputs clean Product schema, exposes a structured commerce API and feed, blocks training-only crawlers, measures real AI traffic and — on Pro — lets agents complete a purchase. Work that would otherwise take a developer sprint per store.',
    seeBadge: 'See the badge you earn',
    plansTitle: 'Free gets you found. Pro gets you bought.',
    plansEyebrow: 'Plans',
    plansSub: 'Read-only visibility is free. Agentic checkout, advanced analytics and the certificate are Pro.',
  },
  pricing: {
    free: 'Free', pro: 'Pro', recommended: 'Recommended', flagship: 'Flagship',
    freeTitle: 'Get discovered', freeSub: 'Agents can find, read and cite your store.',
    proTitle: 'Get bought', proSub: 'Agents transact, you measure it, shoppers trust it.',
    perYear: '/ year',
    freeList: ['AI crawler access', 'llms.txt manifest', 'Basic Product schema', 'Read-only product API'],
    proList: ['Agentic checkout (cart & order API)', 'Advanced AI analytics + export', 'Enriched schema + full Google/XML feed', 'Certificate + trust badge'],
    upgrade: 'Upgrade to Pro',
    capability: 'Capability',
    rows: [
      { label: 'AI crawler access (robots.txt)', free: true, pro: true },
      { label: 'llms.txt manifest', free: 'Basic', pro: 'Custom' },
      { label: 'Product JSON-LD schema', free: 'Basic', pro: 'Enriched (returns, shipping, GTIN)' },
      { label: 'Read-only agent commerce API + OpenAPI', free: true, pro: true },
      { label: 'Product feed', free: 'Up to 20 items', pro: 'Unlimited + Google/XML' },
      { label: 'AI traffic analytics', free: 'Basic counter', pro: 'Trends, per-product, CSV export' },
      { label: 'Agentic checkout — agents add to cart and create orders', free: false, pro: true, flagship: true },
      { label: 'Agent Ready certificate + trust badge', free: false, pro: true },
      { label: 'Automatic updates, unlimited agents, priority support', free: false, pro: true },
    ] as PricingRow[],
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
    scoreLabel: 'aio score',
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
    sub: 'The registry lists stores whose Agent Ready status is confirmed by a live audit. It has just opened and is still empty.',
    cta: 'Be the first — get the plugin',
    wildTitle: 'Found in the wild',
    wildEyebrow: 'Audit snapshot · July 2026',
    wildSub: 'The highest AIO scores our analyzer measured on real stores in July 2026. Scoring has been refined since, so treat this as a snapshot and re-run any audit for today’s result.',
    filter: 'Filter stores or platforms…',
    store: 'Store', platform: 'Platform', passing: 'Passing',
    rerun: 'Re-run this audit live',
    gold: 'Gold', verified: 'Verified-grade',
    noMatch: (q: string) => `No stores match “${q}”.`,
    method: 'Methodology: robots 15 · schema 20 · llms.txt 15 · feed 15 · API 15 · agent layer 20.',
  },
};

export interface PricingRow { label: string; free: boolean | string; pro: boolean | string; flagship?: boolean; }
export type Dict = typeof en;

const sk: Dict = {
  nav: { directory: 'Register', plugin: 'Ukážka pluginu', newAudit: 'Nový audit', language: 'Jazyk', home: 'Agent Ready Shop — domov' },
  common: { copy: 'Kopírovať', copied: 'Skopírované', back: 'Späť', backToAudit: 'Späť na audit', getPlugin: 'Stiahnuť plugin — zadarmo', points: 'b.' },
  hero: {
    eyebrow: 'AIO audit / agentický obchod',
    title: 'Dokážu u vás AI agenti nakúpiť?',
    leadA: 'Nakupovanie sa presúva z ľudí na stroje. ChatGPT, Claude ani Gemini sa vaším e-shopom nepreklikávajú — čítajú ho cez súbory, feedy a API. Zistite, čo agent vo vašom obchode zvládne a čo nie, a získajte opravy, vďaka ktorým dokáže vaše produkty ',
    leadHi: 'prečítať, naceniť aj kúpiť',
    leadB: '.',
    urlLabel: 'Adresa e-shopu',
    placeholder: 'vas-eshop.sk',
    start: 'Spustiť audit',
    meta: ['6 kontrol · 100 bodov', 'Živý audit · bez registrácie', 'Report s odkazom na zdieľanie'],
    figCaption: 'Ilustrácia · ako agent číta stránku produktu',
  },
  errors: {
    title: 'Audit zlyhal',
    rate: 'Z vašej siete prišlo priveľa auditov. Skúste to, prosím, znova o pár minút.',
    invalid: 'Túto adresu nevieme auditovať. Zadajte verejnú doménu e-shopu, napríklad vas-eshop.sk.',
    server: 'Audit sa teraz nepodarilo dokončiť. Skúste to o chvíľu znova.',
    network: 'Nepodarilo sa spojiť s auditnou službou. Skontrolujte pripojenie a skúste to znova.',
  },
  checksSection: { title: 'Čo kontrolujeme', eyebrow: 'Šesť signálov · 100 bodov', max: 'max' },
  features: {
    title: 'Čo pridá plugin',
    eyebrow: 'Jeden plugin pre WordPress',
    items: [
      { title: 'Štruktúrované obchodné API', desc: 'Manifest, produktové API a feed, z ktorých si agenti berú aktuálnu cenu, sklad aj detaily — bez scrapovania.' },
      { title: 'llms.txt a čistá schéma', desc: 'Kontextový súbor a JSON-LD, vďaka ktorým jazykové modely váš katalóg prečítajú, pochopia a citujú.' },
      { title: 'Agentický checkout', desc: 'Agent nacení košík a vytvorí objednávku pripravenú na zaplatenie — skutočná, deterministická cesta k nákupu.' },
    ],
    platformsLabel: 'Plugin pre WordPress · hlboká integrácia s',
    alsoAudits: 'Samotný audit funguje pre akýkoľvek e-shop — Shopify, PrestaShop, Magento, Shoptet, Wix a ďalšie.',
  },
  scan: {
    title: 'Skenujeme e-shop',
    target: 'cieľ',
    steps: [
      'Pripájame sa k e-shopu…',
      'Zisťujeme platformu…',
      'Čítame pravidlá pre AI crawlery (robots.txt)…',
      'Spracúvame štruktúrované dáta Schema.org…',
      'Načítavame /llms.txt…',
      'Kontrolujeme produktové feedy a sitemapy…',
      'Skúšame produktové API a discovery súbory…',
      'Vyhodnocujeme vrstvu pre agentický obchod…',
      'Počítame AIO skóre…',
    ],
  },
  results: {
    platform: 'Zistená platforma',
    pluginActive: 'Plugin aktívny',
    compatible: 'Kompatibilné s pluginom',
    scoreLabel: 'aio skóre',
    level: { gold: 'Certifikovaná pripravenosť', blue: 'Čiastočná pripravenosť', critical: 'Kritická pripravenosť' },
    headline: { gold: 'Váš e-shop je pripravený na agentov', blue: 'Čiastočne pripravený na agentov', critical: 'Váš e-shop je pre AI neviditeľný' },
    subline: {
      gold: 'Agenti prečítajú váš katalóg a dokážu nakúpiť. Vyzdvihnite si certifikát a ukážte odznak dôvery.',
      blue: 'Agenti váš e-shop prečítajú, ale nákup ešte nie je plne deterministický. Odstráňte nedostatky nižšie a získajte certifikát.',
      critical: 'Autonómni agenti váš e-shop spoľahlivo nenájdu a nákup nedokončia. Tu je presne to, čo chýba.',
    },
    viewBadge: 'Zobraziť odznak',
    previewBadge: 'Náhľad odznaku',
    share: 'Zdieľať report',
    linkCopied: 'Odkaz skopírovaný',
    blockedTitle: 'Váš firewall zastavuje AI agentov',
    blockedBody: 'Náš auditor bol zablokovaný alebo dostal overovaciu výzvu pre botov — skutoční nákupní agenti dopadnú rovnako. Aj dokonalá agentická vrstva je za múrom zbytočná: povoľte overených AI agentov (GPTBot, ClaudeBot, PerplexityBot) vo svojom WAF/CDN a spustite audit znova.',
    gapsTitle: (n: number) => (n === 0 ? 'Žiadne nedostatky' : n === 1 ? '1 nedostatok, na ktorý agenti narazia' : n < 5 ? `${n} nedostatky, na ktoré agenti narazia` : `${n} nedostatkov, na ktoré agenti narazia`),
    sortedByImpact: 'Zoradené podľa dopadu',
    inclProductPage: 'Vrátane stránky produktu',
    pass: 'ok',
    fail: 'chýba',
    partial: 'čiastočne',
    fixLabel: 'Oprava',
    solid: 'Už v poriadku',
    fixEyebrow: 'Riešenie',
    fixTitle: 'Jeden plugin nainštaluje celú vrstvu pre agentický obchod',
    fixBodyA: 'Agent Ready Shop',
    fixBodyB: ' je plugin pre WordPress, ktorý urobí skutočnú inžiniersku prácu: vytvára a udržiava váš llms.txt, generuje čistú schému Product, sprístupní štruktúrované obchodné API a feed, blokuje crawlery, ktoré dáta len zbierajú na tréning, meria skutočnú AI návštevnosť a — vo verzii Pro — umožní agentom dokončiť nákup. Práca, ktorá by inak zabrala vývojársky šprint na každý e-shop.',
    seeBadge: 'Pozrite si odznak, ktorý získate',
    plansTitle: 'Free vás zviditeľní. Pro vám predá.',
    plansEyebrow: 'Plány',
    plansSub: 'Viditeľnosť len na čítanie je zadarmo. Agentický checkout, pokročilá analytika a certifikát sú v Pro.',
  },
  pricing: {
    free: 'Free', pro: 'Pro', recommended: 'Odporúčame', flagship: 'Kľúčová funkcia',
    freeTitle: 'Nech vás nájdu', freeSub: 'Agenti váš e-shop nájdu, prečítajú a citujú.',
    proTitle: 'Nech u vás nakúpia', proSub: 'Agenti nakupujú, vy to meriate, zákazníci vám veria.',
    perYear: '/ rok',
    freeList: ['Prístup pre AI crawlery', 'Manifest llms.txt', 'Základná schéma Product', 'Produktové API len na čítanie'],
    proList: ['Agentický checkout (API košíka a objednávok)', 'Pokročilá AI analytika + export', 'Rozšírená schéma + plný Google/XML feed', 'Certifikát + odznak dôvery'],
    upgrade: 'Prejsť na Pro',
    capability: 'Funkcia',
    rows: [
      { label: 'Prístup pre AI crawlery (robots.txt)', free: true, pro: true },
      { label: 'Manifest llms.txt', free: 'Základný', pro: 'Vlastný' },
      { label: 'Schéma Product v JSON-LD', free: 'Základná', pro: 'Rozšírená (vrátenie, doprava, GTIN)' },
      { label: 'API pre agentov len na čítanie + OpenAPI', free: true, pro: true },
      { label: 'Produktový feed', free: 'Do 20 položiek', pro: 'Neobmedzený + Google/XML' },
      { label: 'Analytika AI návštevnosti', free: 'Základné počítadlo', pro: 'Trendy, podľa produktov, export CSV' },
      { label: 'Agentický checkout — agenti vkladajú do košíka a vytvárajú objednávky', free: false, pro: true, flagship: true },
      { label: 'Certifikát Agent Ready + odznak dôvery', free: false, pro: true },
      { label: 'Automatické aktualizácie, neobmedzený počet agentov, prioritná podpora', free: false, pro: true },
    ],
  },
  buy: {
    title: 'Agent Ready Shop Pro',
    sub: 'Odomkne agentický checkout, pokročilú analytiku, rozšírenú schému, plný feed a váš certifikát.',
    perYearStore: '/ rok · 1 e-shop',
    notOnSale: 'Pro sa zatiaľ nepredáva',
    notOnSaleBody: 'Online platba momentálne nie je dostupná, takže licenciu tu zatiaľ nekúpite. Bezplatný plugin môžete naplno používať už dnes a licenčný kľúč Pro doň neskôr zadáte bez preinštalovania.',
    demoTag: 'Demo',
    demoButton: 'Spustiť ukážkový nákup',
    demoNote: 'Ukážkový režim — nič sa neplatí. Táto vývojová verzia vydá testovací licenčný kľúč, aby sa dal vyskúšať postup aktivácie.',
    demoFailed: 'Ukážkovú licenciu sa nepodarilo vydať. Je na serveri nastavený podpisový kľúč?',
    processing: 'Spracúvame…',
    done: 'Ukážkový nákup dokončený — váš testovací licenčný kľúč',
    steps: [
      'Nainštalujte plugin Agent Ready Shop do svojho WooCommerce obchodu.',
      'Otvorte WP Admin → Agent Shop → License.',
      'Vložte kľúč uvedený vyššie a kliknite na Activate.',
      'Funkcie Pro sa zapnú a môžete zobraziť odznak dôvery.',
    ],
  },
  cert: {
    tier: { gold: 'Certifikované · agenti nakupujú', blue: 'Overené · čitateľné pre agentov', none: 'Zatiaľ bez certifikátu' },
    title: { gold: 'Agent Ready Certified', blue: 'Agent Ready Verified', none: 'Certifikát Agent Ready' },
    body: {
      gold: (d: string) => `${d} spĺňa štandard Agent Ready Shop pre obchodovanie s AI agentmi: agenti prečítajú katalóg a dokončia nákup.`,
      blue: (d: string) => `${d} je pre AI agentov čitateľný, ale cesta k nákupu ešte nie je plne deterministická.`,
      none: (d: string) => `${d} zatiaľ štandard Agent Ready Shop nespĺňa. Takto bude odznak vyzerať, keď ho splní.`,
    },
    refId: 'Referenčné ID',
    audited: 'Auditované',
    scoreLabel: 'aio skóre',
    preview: 'Toto je náhľad. Ak chcete odznak zobraziť vo svojom e-shope, aktivujte v plugine licenciu Agent Ready Shop Pro.',
    badge: 'Odznak dôvery',
    dark: 'Tmavý', light: 'Svetlý', verify: 'Overiť',
    embed: 'Vložte do svojho e-shopu',
    html: 'HTML (akýkoľvek web)',
    shortcode: 'Shortcode pre WordPress (plugin)',
    note: 'Odznak odkazuje na verejnú overovaciu stránku. Overuje sa živým opakovaným auditom pri každom otvorení overovacej stránky — skóre vždy pochádza z auditu, nikdy z odkazu.',
  },
  dir: {
    tag: 'Agent Ready Certified',
    title: 'Register certifikovaných e-shopov',
    sub: 'V registri sú e-shopy, ktorých stav Agent Ready potvrdil živý audit. Práve sme ho otvorili a zatiaľ je prázdny.',
    cta: 'Buďte prví — stiahnite si plugin',
    wildTitle: 'Nájdené v teréne',
    wildEyebrow: 'Snímka auditov · júl 2026',
    wildSub: 'Najvyššie AIO skóre, aké náš analyzátor nameral na skutočných e-shopoch v júli 2026. Hodnotenie sme odvtedy spresnili, berte to preto ako snímku a pre dnešný výsledok spustite audit znova.',
    filter: 'Filtrovať e-shopy alebo platformy…',
    store: 'E-shop', platform: 'Platforma', passing: 'Splnené',
    rerun: 'Spustiť tento audit znova naživo',
    gold: 'Gold', verified: 'Úroveň Verified',
    noMatch: (q: string) => `Výrazu „${q}“ nezodpovedá žiadny e-shop.`,
    method: 'Metodika: robots 15 · schéma 20 · llms.txt 15 · feed 15 · API 15 · agentická vrstva 20.',
  },
};

const cs: Dict = {
  nav: { directory: 'Registr', plugin: 'Ukázka pluginu', newAudit: 'Nový audit', language: 'Jazyk', home: 'Agent Ready Shop — domů' },
  common: { copy: 'Kopírovat', copied: 'Zkopírováno', back: 'Zpět', backToAudit: 'Zpět na audit', getPlugin: 'Stáhnout plugin — zdarma', points: 'b.' },
  hero: {
    eyebrow: 'AIO audit / agentický obchod',
    title: 'Dokážou u vás AI agenti nakoupit?',
    leadA: 'Nakupování se přesouvá od lidí ke strojům. ChatGPT, Claude ani Gemini se vaším e-shopem neproklikávají — čtou ho přes soubory, feedy a API. Zjistěte, co agent ve vašem obchodě zvládne a co ne, a získejte opravy, díky kterým dokáže vaše produkty ',
    leadHi: 'přečíst, nacenit i koupit',
    leadB: '.',
    urlLabel: 'Adresa e-shopu',
    placeholder: 'vas-eshop.cz',
    start: 'Spustit audit',
    meta: ['6 kontrol · 100 bodů', 'Živý audit · bez registrace', 'Report s odkazem ke sdílení'],
    figCaption: 'Ilustrace · jak agent čte stránku produktu',
  },
  errors: {
    title: 'Audit selhal',
    rate: 'Z vaší sítě přišlo příliš mnoho auditů. Zkuste to prosím znovu za pár minut.',
    invalid: 'Tuto adresu auditovat neumíme. Zadejte veřejnou doménu e-shopu, například vas-eshop.cz.',
    server: 'Audit se teď nepodařilo dokončit. Zkuste to za chvíli znovu.',
    network: 'Nepodařilo se spojit s auditní službou. Zkontrolujte připojení a zkuste to znovu.',
  },
  checksSection: { title: 'Co kontrolujeme', eyebrow: 'Šest signálů · 100 bodů', max: 'max' },
  features: {
    title: 'Co přidá plugin',
    eyebrow: 'Jeden plugin pro WordPress',
    items: [
      { title: 'Strukturované obchodní API', desc: 'Manifest, produktové API a feed, ze kterých si agenti berou aktuální cenu, sklad i detaily — bez scrapování.' },
      { title: 'llms.txt a čisté schéma', desc: 'Kontextový soubor a JSON-LD, díky kterým jazykové modely váš katalog přečtou, pochopí a citují.' },
      { title: 'Agentický checkout', desc: 'Agent nacení košík a vytvoří objednávku připravenou k zaplacení — skutečná, deterministická cesta k nákupu.' },
    ],
    platformsLabel: 'Plugin pro WordPress · hluboká integrace s',
    alsoAudits: 'Samotný audit funguje pro jakýkoli e-shop — Shopify, PrestaShop, Magento, Shoptet, Wix a další.',
  },
  scan: {
    title: 'Skenujeme e-shop',
    target: 'cíl',
    steps: [
      'Připojujeme se k e-shopu…',
      'Zjišťujeme platformu…',
      'Čteme pravidla pro AI crawlery (robots.txt)…',
      'Zpracováváme strukturovaná data Schema.org…',
      'Načítáme /llms.txt…',
      'Kontrolujeme produktové feedy a sitemapy…',
      'Zkoušíme produktové API a discovery soubory…',
      'Vyhodnocujeme vrstvu pro agentický obchod…',
      'Počítáme AIO skóre…',
    ],
  },
  results: {
    platform: 'Zjištěná platforma',
    pluginActive: 'Plugin aktivní',
    compatible: 'Kompatibilní s pluginem',
    scoreLabel: 'aio skóre',
    level: { gold: 'Certifikovaná připravenost', blue: 'Částečná připravenost', critical: 'Kritická připravenost' },
    headline: { gold: 'Váš e-shop je připravený na agenty', blue: 'Částečně připravený na agenty', critical: 'Váš e-shop je pro AI neviditelný' },
    subline: {
      gold: 'Agenti přečtou váš katalog a dokážou nakoupit. Vyzvedněte si certifikát a ukažte odznak důvěry.',
      blue: 'Agenti váš e-shop přečtou, ale nákup ještě není plně deterministický. Odstraňte nedostatky níže a získejte certifikát.',
      critical: 'Autonomní agenti váš e-shop spolehlivě nenajdou a nákup nedokončí. Tady je přesně to, co chybí.',
    },
    viewBadge: 'Zobrazit odznak',
    previewBadge: 'Náhled odznaku',
    share: 'Sdílet report',
    linkCopied: 'Odkaz zkopírován',
    blockedTitle: 'Váš firewall zastavuje AI agenty',
    blockedBody: 'Náš auditor byl zablokován nebo dostal ověřovací výzvu pro boty — skuteční nákupní agenti dopadnou stejně. I dokonalá agentická vrstva je za zdí k ničemu: povolte ověřené AI agenty (GPTBot, ClaudeBot, PerplexityBot) ve svém WAF/CDN a spusťte audit znovu.',
    gapsTitle: (n: number) => (n === 0 ? 'Žádné nedostatky' : n === 1 ? '1 nedostatek, na který agenti narazí' : n < 5 ? `${n} nedostatky, na které agenti narazí` : `${n} nedostatků, na které agenti narazí`),
    sortedByImpact: 'Seřazeno podle dopadu',
    inclProductPage: 'Včetně stránky produktu',
    pass: 'ok',
    fail: 'chybí',
    partial: 'částečně',
    fixLabel: 'Oprava',
    solid: 'Už v pořádku',
    fixEyebrow: 'Řešení',
    fixTitle: 'Jeden plugin nainstaluje celou vrstvu pro agentický obchod',
    fixBodyA: 'Agent Ready Shop',
    fixBodyB: ' je plugin pro WordPress, který odvede skutečnou inženýrskou práci: vytváří a udržuje váš llms.txt, generuje čisté schéma Product, zpřístupní strukturované obchodní API a feed, blokuje crawlery, které data jen sbírají pro trénink, měří skutečnou AI návštěvnost a — ve verzi Pro — umožní agentům dokončit nákup. Práce, která by jinak zabrala vývojářský sprint na každý e-shop.',
    seeBadge: 'Podívejte se na odznak, který získáte',
    plansTitle: 'Free vás zviditelní. Pro vám prodá.',
    plansEyebrow: 'Tarify',
    plansSub: 'Viditelnost jen pro čtení je zdarma. Agentický checkout, pokročilá analytika a certifikát jsou v Pro.',
  },
  pricing: {
    free: 'Free', pro: 'Pro', recommended: 'Doporučujeme', flagship: 'Klíčová funkce',
    freeTitle: 'Ať vás najdou', freeSub: 'Agenti váš e-shop najdou, přečtou a citují.',
    proTitle: 'Ať u vás nakoupí', proSub: 'Agenti nakupují, vy to měříte, zákazníci vám věří.',
    perYear: '/ rok',
    freeList: ['Přístup pro AI crawlery', 'Manifest llms.txt', 'Základní schéma Product', 'Produktové API jen pro čtení'],
    proList: ['Agentický checkout (API košíku a objednávek)', 'Pokročilá AI analytika + export', 'Rozšířené schéma + plný Google/XML feed', 'Certifikát + odznak důvěry'],
    upgrade: 'Přejít na Pro',
    capability: 'Funkce',
    rows: [
      { label: 'Přístup pro AI crawlery (robots.txt)', free: true, pro: true },
      { label: 'Manifest llms.txt', free: 'Základní', pro: 'Vlastní' },
      { label: 'Schéma Product v JSON-LD', free: 'Základní', pro: 'Rozšířené (vrácení, doprava, GTIN)' },
      { label: 'API pro agenty jen pro čtení + OpenAPI', free: true, pro: true },
      { label: 'Produktový feed', free: 'Do 20 položek', pro: 'Neomezený + Google/XML' },
      { label: 'Analytika AI návštěvnosti', free: 'Základní počítadlo', pro: 'Trendy, podle produktů, export CSV' },
      { label: 'Agentický checkout — agenti vkládají do košíku a vytvářejí objednávky', free: false, pro: true, flagship: true },
      { label: 'Certifikát Agent Ready + odznak důvěry', free: false, pro: true },
      { label: 'Automatické aktualizace, neomezený počet agentů, prioritní podpora', free: false, pro: true },
    ],
  },
  buy: {
    title: 'Agent Ready Shop Pro',
    sub: 'Odemkne agentický checkout, pokročilou analytiku, rozšířené schéma, plný feed a váš certifikát.',
    perYearStore: '/ rok · 1 e-shop',
    notOnSale: 'Pro se zatím neprodává',
    notOnSaleBody: 'Online platba teď není dostupná, takže licenci tady zatím nekoupíte. Bezplatný plugin můžete naplno používat už dnes a licenční klíč Pro do něj později zadáte bez přeinstalování.',
    demoTag: 'Demo',
    demoButton: 'Spustit ukázkový nákup',
    demoNote: 'Ukázkový režim — nic se neplatí. Tato vývojová verze vydá testovací licenční klíč, aby šel vyzkoušet postup aktivace.',
    demoFailed: 'Ukázkovou licenci se nepodařilo vydat. Je na serveru nastavený podpisový klíč?',
    processing: 'Zpracováváme…',
    done: 'Ukázkový nákup dokončen — váš testovací licenční klíč',
    steps: [
      'Nainstalujte plugin Agent Ready Shop do svého WooCommerce obchodu.',
      'Otevřete WP Admin → Agent Shop → License.',
      'Vložte klíč uvedený výše a klikněte na Activate.',
      'Funkce Pro se zapnou a můžete zobrazit odznak důvěry.',
    ],
  },
  cert: {
    tier: { gold: 'Certifikováno · agenti nakupují', blue: 'Ověřeno · čitelné pro agenty', none: 'Zatím bez certifikátu' },
    title: { gold: 'Agent Ready Certified', blue: 'Agent Ready Verified', none: 'Certifikát Agent Ready' },
    body: {
      gold: (d: string) => `${d} splňuje standard Agent Ready Shop pro obchodování s AI agenty: agenti přečtou katalog a dokončí nákup.`,
      blue: (d: string) => `${d} je pro AI agenty čitelný, ale cesta k nákupu ještě není plně deterministická.`,
      none: (d: string) => `${d} zatím standard Agent Ready Shop nesplňuje. Takhle bude odznak vypadat, až ho splní.`,
    },
    refId: 'Referenční ID',
    audited: 'Auditováno',
    scoreLabel: 'aio skóre',
    preview: 'Toto je náhled. Chcete-li odznak zobrazit ve svém e-shopu, aktivujte v pluginu licenci Agent Ready Shop Pro.',
    badge: 'Odznak důvěry',
    dark: 'Tmavý', light: 'Světlý', verify: 'Ověřit',
    embed: 'Vložte do svého e-shopu',
    html: 'HTML (jakýkoli web)',
    shortcode: 'Shortcode pro WordPress (plugin)',
    note: 'Odznak odkazuje na veřejnou ověřovací stránku. Ověřuje se živým opakovaným auditem při každém otevření ověřovací stránky — skóre vždy pochází z auditu, nikdy z odkazu.',
  },
  dir: {
    tag: 'Agent Ready Certified',
    title: 'Registr certifikovaných e-shopů',
    sub: 'V registru jsou e-shopy, jejichž stav Agent Ready potvrdil živý audit. Právě jsme ho otevřeli a zatím je prázdný.',
    cta: 'Buďte první — stáhněte si plugin',
    wildTitle: 'Nalezeno v terénu',
    wildEyebrow: 'Snímek auditů · červenec 2026',
    wildSub: 'Nejvyšší AIO skóre, jaké náš analyzátor naměřil na skutečných e-shopech v červenci 2026. Hodnocení jsme od té doby zpřesnili, berte to proto jako snímek a pro dnešní výsledek spusťte audit znovu.',
    filter: 'Filtrovat e-shopy nebo platformy…',
    store: 'E-shop', platform: 'Platforma', passing: 'Splněno',
    rerun: 'Spustit tento audit znovu naživo',
    gold: 'Gold', verified: 'Úroveň Verified',
    noMatch: (q: string) => `Výrazu „${q}“ neodpovídá žádný e-shop.`,
    method: 'Metodika: robots 15 · schéma 20 · llms.txt 15 · feed 15 · API 15 · agentická vrstva 20.',
  },
};

export const DICTS: Record<Lang, Dict> = { en, sk, cs };

interface I18n { lang: Lang; t: Dict; setLang: (l: Lang) => void; }
const Ctx = createContext<I18n>({ lang: 'en', t: en, setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(STORAGE_KEY, l); } catch { /* storage unavailable */ }
    // An explicit ?lang= would otherwise win again on the next load.
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); window.history.replaceState(null, '', u.pathname + u.search + u.hash); }
    } catch { /* ignore */ }
  }, []);

  const value = useMemo<I18n>(() => ({ lang, t: DICTS[lang], setLang }), [lang, setLang]);
  return createElement(Ctx.Provider, { value }, children);
}

export const useT = (): I18n => useContext(Ctx);
