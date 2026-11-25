import React, { useState } from 'react';
import {
  ShoppingBag, FileText, Unlock, Database, Award, TrendingUp,
  ArrowLeft, Settings, Download, Cpu, CheckCircle2, Lock, ExternalLink, Zap
} from 'lucide-react';
import { downloadPlugin } from './utils/pluginGenerator';
import { Certificate } from './Certificate';
import { Pricing } from './Pricing';
import { BuyPro } from './BuyPro';

interface PluginDashboardProps {
  onExit: () => void;
}

const DEMO_DOMAIN = 'demo-store.com';

export interface DashSettings {
  enableJsonLd: boolean;
  suppressWcSchema: boolean;
  enrichedSchema: boolean;
  enableXmlFeed: boolean;
  feedMaxItems: number;
  cacheTtl: number;
  llmsEnabled: boolean;
  llmsIntro: string;
  agents: Record<string, boolean>;
  showBadge: boolean;
  analytics: boolean;
  rateLimit: boolean;
  blockTraining: boolean;
}

const DEFAULT_SETTINGS: DashSettings = {
  enableJsonLd: true,
  suppressWcSchema: false,
  enrichedSchema: true,
  enableXmlFeed: true,
  feedMaxItems: 500,
  cacheTtl: 3600,
  llmsEnabled: true,
  llmsIntro: '',
  agents: {
    GPTBot: true, 'OAI-SearchBot': true, 'ChatGPT-User': true, ClaudeBot: true,
    'Claude-User': true, PerplexityBot: true, 'Google-Extended': true,
    'Applebot-Extended': true, Amazonbot: false, 'Meta-ExternalAgent': false,
  },
  showBadge: true,
  analytics: true,
  rateLimit: true,
  blockTraining: false,
};

export function PluginDashboard({ onExit }: PluginDashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [licenseKey, setLicenseKey] = useState('');
  const [isPro, setIsPro] = useState(false);
  const [settings, setSettings] = useState<DashSettings>(DEFAULT_SETTINGS);
  const set = <K extends keyof DashSettings>(k: K, v: DashSettings[K]) => setSettings(s => ({ ...s, [k]: v }));

  return (
    <div className="flex h-screen bg-[#f0f0f1] text-[#2c3338] font-sans overflow-hidden text-[13px]">

      {/* WP Admin Sidebar */}
      <div className="w-[160px] md:w-[200px] bg-[#1d2327] text-white flex flex-col flex-shrink-0 z-20 overflow-y-auto">
        <div onClick={onExit} className="p-3 bg-[#135e96] hover:bg-[#2271b1] cursor-pointer flex items-center gap-2 text-sm font-medium transition-colors">
          <ArrowLeft size={16} /> Back to Analyzer
        </div>
        <div className="py-2 mt-2">
          <div className="px-3 py-2 text-[11px] uppercase text-[#a7aaad] font-semibold tracking-wider">Overview</div>
          <MenuLink id="dashboard" icon={<ShoppingBag size={16} />} label="Dashboard" active={activeTab} set={setActiveTab} />
          <MenuLink id="certificate" icon={<Award size={16} />} label="Certificate & Badge" active={activeTab} set={setActiveTab} />
          <MenuLink id="traffic" icon={<TrendingUp size={16} />} label="AI Traffic" active={activeTab} set={setActiveTab} />
          <MenuLink id="plans" icon={<Zap size={16} />} label="Plans" active={activeTab} set={setActiveTab} />

          <div className="px-3 py-2 mt-4 text-[11px] uppercase text-[#a7aaad] font-semibold tracking-wider">Optimization</div>
          <MenuLink id="llms" icon={<FileText size={16} />} label="llms.txt" active={activeTab} set={setActiveTab} />
          <MenuLink id="access" icon={<Unlock size={16} />} label="AI Access (robots)" active={activeTab} set={setActiveTab} />
          <MenuLink id="schema" icon={<Database size={16} />} label="Schema (JSON-LD)" active={activeTab} set={setActiveTab} />
          <MenuLink id="api" icon={<Cpu size={16} />} label="API & Feed" active={activeTab} set={setActiveTab} />

          <div className="px-3 py-2 mt-4 text-[11px] uppercase text-[#a7aaad] font-semibold tracking-wider">System</div>
          <MenuLink id="settings" icon={<Settings size={16} />} label="Settings & License" active={activeTab} set={setActiveTab} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f0f0f1]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-[23px] font-normal text-[#1d2327]">Agent Ready Shop</h1>
            <span className="bg-[#2271b1] text-white px-2 py-0.5 rounded-[3px] text-xs font-medium">v1.0.0</span>
            {isPro && <span className="bg-[#00a32a] text-white px-2 py-0.5 rounded-[3px] text-xs font-medium">PRO</span>}
          </div>
          <button onClick={() => downloadPlugin()} className="bg-[#2271b1] hover:bg-[#135e96] text-white px-4 py-2 rounded-[3px] font-medium border-0 cursor-pointer shadow-sm flex items-center gap-2 text-[13px] transition-colors">
            <Download size={14} /> Download plugin (.zip)
          </button>
        </div>

        <div className="max-w-[1000px]">
          {activeTab === 'dashboard' && <TabDashboard isPro={isPro} onUnlock={() => setActiveTab('settings')} />}
          {activeTab === 'certificate' && <Certificate domain={DEMO_DOMAIN} score={isPro ? 100 : 85} eligible={isPro} />}
          {activeTab === 'traffic' && <TabTraffic analytics={settings.analytics} set={set} />}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              <Pricing onSelectPro={() => setActiveTab('settings')} />
              <BuyPro />
            </div>
          )}
          {activeTab === 'llms' && <TabLlms s={settings} set={set} isPro={isPro} />}
          {activeTab === 'access' && <TabAccess s={settings} set={set} />}
          {activeTab === 'schema' && <TabSchema s={settings} set={set} isPro={isPro} />}
          {activeTab === 'api' && <TabApiFeed s={settings} set={set} />}
          {activeTab === 'settings' && (
            <TabSettings licenseKey={licenseKey} setLicenseKey={setLicenseKey} isPro={isPro} setIsPro={setIsPro} s={settings} set={set} />
          )}
        </div>
      </div>
    </div>
  );
}

type Setter = <K extends keyof DashSettings>(k: K, v: DashSettings[K]) => void;

// --- Reusable controls ---
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-[22px] w-[40px] items-center rounded-full transition-colors flex-shrink-0 border-0 ${checked ? 'bg-[#2271b1]' : 'bg-[#c3c4c7]'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className={`inline-block h-[16px] w-[16px] transform rounded-full bg-white transition-transform ${checked ? 'translate-x-[21px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

function SettingRow({ label, desc, pro, children }: { label: string; desc?: string; pro?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#f0f0f1] last:border-0">
      <div>
        <div className="font-medium text-[#1d2327] flex items-center gap-2">
          {label}
          {pro && <span className="bg-[#2271b1] text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">Pro</span>}
        </div>
        {desc && <p className="text-[#50575e] text-[12px] m-0 mt-0.5 max-w-md leading-relaxed">{desc}</p>}
      </div>
      <div className="flex-shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

function SaveBar() {
  const [status, setStatus] = useState('');
  return (
    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#f0f0f1]">
      <button onClick={() => { setStatus('Saving…'); setTimeout(() => { setStatus('✓ Saved & regenerated'); setTimeout(() => setStatus(''), 2500); }, 500); }}
        className="bg-[#2271b1] hover:bg-[#135e96] text-white px-4 py-1.5 rounded-[3px] font-medium border-0 cursor-pointer shadow-sm text-xs">
        Save changes
      </button>
      {status && <span className="text-[#007017] font-semibold text-xs">{status}</span>}
    </div>
  );
}

// --- Tabs ---
const SCORE_ROWS = (isPro: boolean) => [
  { label: 'AI agent access (robots.txt)', pts: 15, max: 15 },
  { label: 'llms.txt manifest', pts: 10, max: 10 },
  { label: 'Read-only Agent Commerce API', pts: 15, max: 15 },
  { label: 'Product JSON-LD schema', pts: 10, max: 10 },
  { label: 'Agentic checkout (cart & order API)', pts: isPro ? 20 : 0, max: 20 },
  { label: 'Enriched schema + full feed + analytics', pts: isPro ? 30 : 0, max: 30 },
];

function TabDashboard({ isPro, onUnlock }: { isPro: boolean; onUnlock: () => void }) {
  const rows = SCORE_ROWS(isPro);
  const score = rows.reduce((a, r) => a + r.pts, 0);
  const color = score >= 85 ? '#00a32a' : score >= 60 ? '#2271b1' : '#dba617';
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <WpCard title="Your store's AIO score">
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 flex-shrink-0 flex flex-col items-center justify-center rounded-full border-[6px]" style={{ borderColor: color }}>
              <span className="text-2xl font-bold" style={{ color }}>{score}</span>
              <span className="text-[9px] text-[#8c8f94]">/ 100</span>
            </div>
            <ul className="m-0 p-0 list-none flex-1 space-y-1">
              {rows.map(r => (
                <li key={r.label} className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    {r.pts >= r.max ? <CheckCircle2 size={14} className="text-[#008a20]" /> : <Lock size={12} className="text-[#a7aaad]" />}
                    {r.label}
                  </span>
                  <span className="text-[#50575e]">{r.pts}/{r.max}</span>
                </li>
              ))}
            </ul>
          </div>
        </WpCard>
        <WpCard title="Status">
          <p className="text-[14px] mb-2 font-medium">
            {isPro ? <>Status: <span className="text-[#00a32a]">Agent Ready · Certified</span></> : <>Status: <span className="text-[#dba617]">Agent Ready · Free (uncertified)</span></>}
          </p>
          <p className="text-[#3c434a] leading-relaxed mb-4">
            {isPro ? 'Fully optimized for AI agents with a verifiable certificate and the trust badge live on your storefront.'
              : 'Your catalog is readable and buyable for AI agents. Activate a Pro license to mint your certificate and switch on the badge.'}
          </p>
          {!isPro && <button onClick={onUnlock} className="bg-[#2271b1] hover:bg-[#135e96] text-white px-4 py-1.5 rounded-[3px] font-medium border-0 cursor-pointer shadow-sm">Activate license</button>}
        </WpCard>
      </div>
    </div>
  );
}

function TabTraffic({ analytics, set }: { analytics: boolean; set: Setter }) {
  const agents = [{ name: 'Google-Extended', n: 4112 }, { name: 'GPTBot', n: 1423 }, { name: 'PerplexityBot', n: 210 }, { name: 'ClaudeBot', n: 89 }];
  const refs = [{ name: 'ChatGPT', n: 320 }, { name: 'Perplexity', n: 76 }, { name: 'Gemini', n: 41 }];
  const pagesRead = [{ p: '/product/garmin-venu-3', n: 812 }, { p: '/shop', n: 604 }, { p: '/product/trail-shoes', n: 331 }];
  const cited = [{ p: '/product/garmin-venu-3', n: 142 }, { p: '/returns-policy', n: 58 }, { p: '/product/trail-shoes', n: 33 }];
  const total = agents.reduce((a, x) => a + x.n, 0);
  const verified = 5210, spoofed = 118;
  const max = Math.max(...agents.map(a => a.n));
  return (
    <div className="space-y-5">
      <WpCard title="AI traffic analytics">
        <SettingRow label="Record AI traffic" desc="Log visits from AI agents and AI-assistant referrals (30-day rolling window). 100% local — no account, no data sent anywhere.">
          <Toggle checked={analytics} onChange={v => set('analytics', v)} />
        </SettingRow>
      </WpCard>
      {analytics ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <WpCard title="AI agent visits (last 30 days · example)">
              <p className="mt-0 mb-1">
                <span className="text-2xl font-bold text-[#1d2327]">{total.toLocaleString()}</span> <span className="text-[#50575e]">AI hits</span>
                <span className="ml-3 text-[#007017] text-xs font-semibold">{verified.toLocaleString()} verified</span>
                <span className="ml-2 text-[#d63638] text-xs font-semibold">{spoofed} spoofed</span>
              </p>
              <p className="text-xs text-[#8c8f94] mt-0 mb-3">Verified = client IP confirmed against the operator's published ranges.</p>
              <div className="space-y-3">
                {agents.map(a => (
                  <div key={a.name}>
                    <div className="flex justify-between text-[13px] mb-1"><span className="font-mono text-[#1d2327]">{a.name}</span><span className="font-semibold">{a.n.toLocaleString()}</span></div>
                    <div className="w-full bg-[#f0f0f1] h-3 rounded-sm overflow-hidden border border-[#dcdcde]"><div className="bg-[#2271b1] h-3" style={{ width: `${Math.round((a.n / max) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </WpCard>
            <WpCard title="Referrals from AI assistants">
              <table className="w-full text-left border-collapse">
                <tbody>{refs.map(r => (<tr key={r.name} className="border-b border-[#f0f0f1]"><td className="py-2.5 text-[#1d2327]">{r.name}</td><td className="py-2.5 text-right"><span className="bg-[#edfaef] text-[#007017] px-2 py-0.5 rounded text-xs font-semibold">{r.n.toLocaleString()} sessions</span></td></tr>))}</tbody>
              </table>
              <div className="mt-4 pt-3 border-t border-[#f0f0f1]">
                <button className="bg-white border border-[#c3c4c7] text-[#3c434a] px-3 py-1.5 rounded-[3px] text-xs font-medium cursor-pointer">Export CSV <span className="ml-1 bg-[#2271b1] text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">Pro</span></button>
              </div>
            </WpCard>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <WpCard title="Top pages read by agents">
              <table className="w-full text-left border-collapse">
                <tbody>{pagesRead.map(x => (<tr key={x.p} className="border-b border-[#f0f0f1]"><td className="py-2 font-mono text-[12px] text-[#2271b1]">{x.p}</td><td className="py-2 text-right text-[#50575e]">{x.n}</td></tr>))}</tbody>
              </table>
            </WpCard>
            <WpCard title="Pages cited by AI assistants">
              <p className="text-xs text-[#50575e] mt-0 mb-2">Landing pages of visitors arriving from an AI citation — your GEO/AEO winners.</p>
              <table className="w-full text-left border-collapse">
                <tbody>{cited.map(x => (<tr key={x.p} className="border-b border-[#f0f0f1]"><td className="py-2 font-mono text-[12px] text-[#2271b1]">{x.p}</td><td className="py-2 text-right text-[#50575e]">{x.n}</td></tr>))}</tbody>
              </table>
            </WpCard>
          </div>
        </>
      ) : <WpCard><p className="m-0 text-[#50575e]">Analytics are turned off. Enable the toggle above to start recording AI traffic.</p></WpCard>}
    </div>
  );
}

function TabLlms({ s, set, isPro }: { s: DashSettings; set: Setter; isPro: boolean }) {
  return (
    <div className="space-y-5">
      <WpCard title="/llms.txt manifest">
        <SettingRow label="Enable generation" desc="Serve a live Markdown manifest at /llms.txt describing your store, endpoints and policies.">
          <Toggle checked={s.llmsEnabled} onChange={v => set('llmsEnabled', v)} />
        </SettingRow>
        <div className="py-3 border-b border-[#f0f0f1]">
          <div className="font-medium text-[#1d2327] flex items-center gap-2 mb-1">Custom intro <span className="bg-[#2271b1] text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">Pro</span></div>
          <textarea value={s.llmsIntro} onChange={e => set('llmsIntro', e.target.value)} disabled={!isPro || !s.llmsEnabled} rows={2}
            placeholder={isPro ? 'Optional custom summary for AI agents…' : 'Activate Pro to customize the intro'}
            className="w-full border border-[#8c8f94] rounded-[3px] p-2 text-[13px] outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1] disabled:bg-[#f0f0f1] disabled:text-[#8c8f94]" />
        </div>
        <SaveBar />
      </WpCard>
      <WpCard title="Preview">
        <pre className="bg-[#1d2327] text-[#a7aaad] p-4 rounded-sm font-mono text-[12px] leading-relaxed overflow-x-auto whitespace-pre-wrap">{s.llmsEnabled ? `# Demo Store

> ${isPro && s.llmsIntro ? s.llmsIntro : 'Online shop. Product data is available to AI agents in structured form.'}

## Machine-readable endpoints
- [Agent manifest](/.well-known/agent-shop.json)
- [Product feed](/wp-json/agent-shop/v1/products)${s.enableXmlFeed ? '\n- [Google product feed](/agent-shop-feed.xml)' : ''}` : '(llms.txt generation is disabled)'}</pre>
      </WpCard>
    </div>
  );
}

const TRAINING_BOTS = ['CCBot', 'Google-Extended', 'Applebot-Extended', 'Bytespider', 'Amazonbot', 'Meta-ExternalAgent'];

function TabAccess({ s, set }: { s: DashSettings; set: Setter }) {
  const isTraining = (b: string) => TRAINING_BOTS.includes(b);
  const allowed = Object.entries(s.agents).filter(([b, v]) => v && !(s.blockTraining && isTraining(b))).map(([k]) => k);
  const blocked = s.blockTraining ? TRAINING_BOTS : [];
  const robots =
    '# Agent Ready Shop — AI crawlers explicitly allowed\n' +
    (allowed.length ? allowed.map(b => `User-agent: ${b}\nAllow: /`).join('\n\n') : '# (no agents enabled)') +
    (blocked.length ? '\n\n# Blocked: AI training crawlers\n' + blocked.map(b => `User-agent: ${b}\nDisallow: /`).join('\n\n') : '');
  return (
    <div className="space-y-5">
      <WpCard title="AI agent access (robots.txt)">
        <SettingRow label="Block AI training crawlers" desc="Deny model-training bots (CCBot, Google-Extended, Bytespider…) while still welcoming shopping agents. Let AI buy from you without feeding your catalog into training sets.">
          <Toggle checked={s.blockTraining} onChange={v => set('blockTraining', v)} />
        </SettingRow>
        <p className="text-[#50575e] mt-3 mb-2 text-[12px]">Per-agent allow. Training-category bots are tagged.</p>
        {Object.keys(s.agents).map(bot => (
          <React.Fragment key={bot}>
            <SettingRow label={bot} desc={isTraining(bot) ? 'AI training' : undefined}>
              <Toggle checked={s.agents[bot] && !(s.blockTraining && isTraining(bot))} onChange={v => set('agents', { ...s.agents, [bot]: v })} disabled={s.blockTraining && isTraining(bot)} />
            </SettingRow>
          </React.Fragment>
        ))}
        <SaveBar />
      </WpCard>
      <WpCard title="Dynamic robots.txt output">
        <pre className="bg-[#1d2327] text-[#a7aaad] p-4 rounded-sm font-mono text-[12px] leading-relaxed whitespace-pre-line">{robots}</pre>
      </WpCard>
    </div>
  );
}

function TabSchema({ s, set, isPro }: { s: DashSettings; set: Setter; isPro: boolean }) {
  const enriched = isPro && s.enrichedSchema;
  const jsonld = JSON.stringify({
    '@context': 'https://schema.org/', '@type': 'Product', name: 'Sample Product', sku: 'SKU-123',
    offers: {
      '@type': 'Offer', priceCurrency: 'EUR', price: '129.00', availability: 'https://schema.org/InStock',
      ...(enriched ? {
        hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', merchantReturnDays: 14, returnFees: 'https://schema.org/FreeReturn' },
        shippingDetails: { '@type': 'OfferShippingDetails', deliveryTime: { '@type': 'ShippingDeliveryTime', transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 5, unitCode: 'DAY' } } },
      } : {}),
    },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.6, reviewCount: 128 },
  }, null, 2);
  return (
    <div className="space-y-5">
      <WpCard title="Product JSON-LD schema">
        <SettingRow label="Output Product JSON-LD" desc="Emit Schema.org Product / Offer markup on every product page.">
          <Toggle checked={s.enableJsonLd} onChange={v => set('enableJsonLd', v)} />
        </SettingRow>
        <SettingRow label="Suppress WooCommerce native schema" desc="Avoid duplicate Product schema from WooCommerce or SEO plugins.">
          <Toggle checked={s.suppressWcSchema} onChange={v => set('suppressWcSchema', v)} />
        </SettingRow>
        <SettingRow label="Enriched schema" desc="Add MerchantReturnPolicy + shipping details — the conditions agents compare on." pro>
          <Toggle checked={enriched} onChange={v => set('enrichedSchema', v)} disabled={!isPro} />
        </SettingRow>
        <SaveBar />
      </WpCard>
      <WpCard title={`Live JSON-LD output ${s.enableJsonLd ? '' : '(disabled)'}`}>
        {s.enableJsonLd
          ? <pre className="bg-[#1d2327] text-[#a7aaad] p-4 rounded-sm font-mono text-[12px] leading-relaxed overflow-x-auto">{jsonld}</pre>
          : <p className="m-0 text-[#50575e]">JSON-LD output is turned off.</p>}
      </WpCard>
    </div>
  );
}

function TabApiFeed({ s, set }: { s: DashSettings; set: Setter }) {
  const rows: [string, string, string, boolean?][] = [
    ['Manifest', '/.well-known/agent-shop.json', 'Capabilities + endpoint index'],
    ['Products (JSON)', '/wp-json/agent-shop/v1/products', 'Normalized feed: price, stock, SKU, GTIN'],
    ['OpenAPI', '/wp-json/agent-shop/v1/openapi.json', 'Tool discovery for agents'],
    ['Google feed (XML)', '/agent-shop-feed.xml', 'Merchant / RSS product feed'],
    ['Quote', '/wp-json/agent-shop/v1/quote', 'Price a basket for an agent', true],
    ['Agentic checkout', '/wp-json/agent-shop/v1/checkout', 'Agent creates a ready-to-pay order', true],
  ];
  return (
    <div className="space-y-5">
      <WpCard title="Feed & cache settings">
        <SettingRow label="Google / XML product feed" desc="Serve a Merchant-style feed at /agent-shop-feed.xml.">
          <Toggle checked={s.enableXmlFeed} onChange={v => set('enableXmlFeed', v)} />
        </SettingRow>
        <SettingRow label="Max items in feed">
          <input type="number" min={10} max={5000} step={10} value={s.feedMaxItems} onChange={e => set('feedMaxItems', parseInt(e.target.value) || 0)}
            className="w-24 border border-[#8c8f94] rounded-[3px] px-2 py-1 bg-white text-gray-800 text-[13px]" />
        </SettingRow>
        <SettingRow label="Feed cache (seconds)" desc="0 disables caching. Cache clears automatically when a product changes.">
          <input type="number" min={0} step={60} value={s.cacheTtl} onChange={e => set('cacheTtl', parseInt(e.target.value) || 0)}
            className="w-28 border border-[#8c8f94] rounded-[3px] px-2 py-1 bg-white text-gray-800 text-[13px]" />
        </SettingRow>
        <SettingRow label="Agentic rate limiting" desc="Per-agent token buckets. Never throttles the checkout money-path.">
          <Toggle checked={s.rateLimit} onChange={v => set('rateLimit', v)} />
        </SettingRow>
        <SaveBar />
      </WpCard>

      <WpCard title="Agent Commerce API & feeds">
        <table className="w-full text-left border-collapse">
          <thead><tr className="border-b border-[#c3c4c7] text-[#1d2327]"><th className="py-2.5 font-semibold">Surface</th><th className="py-2.5 font-semibold">Path</th><th className="py-2.5 font-semibold">Purpose</th></tr></thead>
          <tbody>
            {rows.filter(r => r[0] !== 'Google feed (XML)' || s.enableXmlFeed).map(([name, path, desc, pro]) => (
              <tr key={path} className={`border-b border-[#f0f0f1] ${pro ? 'bg-[#f0f6fc]' : ''}`}>
                <td className="py-3 font-medium text-[#1d2327]">{name}{pro && <span className="ml-2 inline-block bg-[#2271b1] text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded align-middle">Pro</span>}</td>
                <td className="py-3 font-mono text-[#2271b1] text-[12px]">{path}</td>
                <td className="py-3 text-[#50575e]">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </WpCard>

      {s.rateLimit && (
        <WpCard title="Agentic rate limiting">
          <p className="text-[#50575e] mt-0 mb-4 leading-relaxed">A 429 is a readable instruction (<code>Retry-After</code> + <code>scope</code>), never a bare rejection — and the <strong>checkout money-path is never throttled</strong>.</p>
          <table className="w-full text-left border-collapse">
            <thead><tr className="border-b border-[#c3c4c7] text-[#1d2327]"><th className="py-2 font-semibold">Class</th><th className="py-2 font-semibold">Routes</th><th className="py-2 font-semibold">Budget</th></tr></thead>
            <tbody>
              <tr className="border-b border-[#f0f0f1]"><td className="py-2.5 font-medium">discovery</td><td className="py-2.5 font-mono text-[12px] text-[#2271b1]">products, categories, manifest</td><td className="py-2.5 text-[#50575e]">300/min · burst 400</td></tr>
              <tr className="border-b border-[#f0f0f1]"><td className="py-2.5 font-medium">cart</td><td className="py-2.5 font-mono text-[12px] text-[#2271b1]">quote</td><td className="py-2.5 text-[#50575e]">60/min · burst 90</td></tr>
              <tr><td className="py-2.5 font-medium">checkout</td><td className="py-2.5 font-mono text-[12px] text-[#2271b1]">checkout</td><td className="py-2.5 text-[#007017] font-medium">never hard-blocked</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-[#50575e] mt-3 mb-0">Verified agents get full budget; anonymous ~20%. Limits are advertised in the manifest so agents self-pace.</p>
        </WpCard>
      )}
    </div>
  );
}

interface TabSettingsProps {
  licenseKey: string; setLicenseKey: (k: string) => void;
  isPro: boolean; setIsPro: (b: boolean) => void;
  s: DashSettings; set: Setter;
}

function TabSettings({ licenseKey, setLicenseKey, isPro, setIsPro, s, set }: TabSettingsProps) {
  const [localKey, setLocalKey] = useState(licenseKey);
  const [saveStatus, setSaveStatus] = useState('');
  const save = () => {
    setSaveStatus('Saving…');
    setLicenseKey(localKey);
    const pro = localKey.trim().length > 5;
    setIsPro(pro);
    setTimeout(() => { setSaveStatus(pro ? '✓ Saved. Pro unlocked — certificate & badge active.' : '✓ Saved. Free mode.'); setTimeout(() => setSaveStatus(''), 3500); }, 600);
  };
  return (
    <div className="space-y-5">
      <WpCard title="License">
        <div className="py-2">
          <div className="font-medium text-[#1d2327] mb-2">Agent Ready Shop license key</div>
          <input type="text" value={localKey} onChange={e => setLocalKey(e.target.value)}
            className="border border-[#8c8f94] rounded-[3px] py-1.5 px-3 bg-white text-gray-800 text-[13px] max-w-sm w-full font-mono outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]"
            placeholder="ARS-XXXXX-XXXXX-…" />
          <p className="text-xs text-gray-500 mt-2 m-0 bg-[#eef2f5] p-2 leading-relaxed rounded border border-[#dfdfdf]">💡 Demo: type any text with 6+ characters (e.g. <code>ARS-DEMO-PRO</code>) and Save to preview Pro.</p>
          {isPro && <p className="text-[#007017] font-semibold text-xs mt-2 flex items-center gap-1"><CheckCircle2 size={14} /> License active</p>}
          <div className="mt-3"><button onClick={save} className="bg-[#2271b1] hover:bg-[#135e96] text-white px-4 py-1.5 rounded-[3px] font-medium border-0 cursor-pointer shadow-sm text-xs">Save license</button> {saveStatus && <span className="text-[#007017] font-semibold text-xs ml-2">{saveStatus}</span>}</div>
        </div>
      </WpCard>

      <WpCard title="Certificate & badge">
        <SettingRow label="Storefront trust badge" desc='Show the "Agent Ready Certified" badge in the footer.' pro>
          <Toggle checked={s.showBadge} onChange={v => set('showBadge', v)} disabled={!isPro} />
        </SettingRow>
        <SettingRow label="AI traffic analytics" desc="Record AI agent visits and referrals (30-day window).">
          <Toggle checked={s.analytics} onChange={v => set('analytics', v)} />
        </SettingRow>
        {isPro && <p className="mt-3 mb-0 text-[13px]"><a href="/verify/" onClick={e => e.preventDefault()} className="text-[#2271b1] flex items-center gap-1 w-fit"><ExternalLink size={13} /> Public verification page</a></p>}
      </WpCard>
    </div>
  );
}

function WpCard({ title, children, className = '' }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-[#c3c4c7] shadow-[0_1px_1px_rgba(0,0,0,0.04)] ${className}`}>
      {title && <h2 className="px-4 py-3 m-0 border-b border-[#c3c4c7] text-[#1d2327] font-medium text-[14px]">{title}</h2>}
      <div className="p-4 flex flex-col text-[13px]">{children}</div>
    </div>
  );
}

function MenuLink({ id, icon, label, active, set }: { id: string; icon: React.ReactNode; label: string; active: string; set: (s: string) => void }) {
  const isActive = active === id;
  return (
    <div onClick={() => set(id)} className={`px-3 py-2 cursor-pointer flex items-center gap-2 text-[13px] transition-colors ${isActive ? 'bg-[#2271b1] text-white font-medium' : 'text-[#c3c4c7] hover:bg-[#2c3338] hover:text-white'}`}>
      {icon} {label}
    </div>
  );
}
