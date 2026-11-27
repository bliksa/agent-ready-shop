/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, FormEvent, ReactNode } from 'react';
import { absUrl, withBase } from './utils/base';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Search, ShieldAlert, ShieldCheck, Cpu, Code2, CheckCircle2, XCircle, ArrowRight, Zap, RefreshCw, Globe, LayoutTemplate, Award, Sparkles, ShoppingBag, Link2, Check } from 'lucide-react';
import { runSimulatedAudit } from './data/auditConfig';
import { AuditResult, AuditCheck } from './types';
import { PluginDashboard } from './PluginDashboard';
import { Certificate } from './Certificate';
import { Pricing } from './Pricing';
import { Directory } from './Directory';
import { LicenseGenerator } from './LicenseGenerator';
import { PluginShots } from './PluginShots';
import { normalizeDomain } from './utils/badge';

export default function App() {
  const [appMode, setAppMode] = useState<'analyzer' | 'plugin' | 'certificate' | 'directory' | 'generator'>(
    typeof window !== 'undefined' && window.location.hash === '#generator' ? 'generator' : 'analyzer'
  );
  const [url, setUrl] = useState('');
  const [appState, setAppState] = useState<'idle' | 'scanning' | 'results'>('idle');
  const [loadingMsg, setLoadingMsg] = useState('');
  const [result, setResult] = useState<AuditResult | null>(null);

  if (appMode === 'plugin') {
    return <PluginDashboard onExit={() => setAppMode('analyzer')} />;
  }

  if (appMode === 'directory') {
    return (
      <Shell>
        <TopBar onHome={() => setAppMode('analyzer')} onPlugin={() => setAppMode('plugin')} onDirectory={() => setAppMode('directory')} />
        <main className="max-w-7xl mx-auto px-4 py-12"><Directory onBack={() => setAppMode('analyzer')} /></main>
      </Shell>
    );
  }

  if (appMode === 'generator') {
    return (
      <Shell>
        <TopBar onHome={() => setAppMode('analyzer')} onPlugin={() => setAppMode('plugin')} />
        <main className="max-w-7xl mx-auto px-4 py-12"><LicenseGenerator onBack={() => setAppMode('analyzer')} /></main>
      </Shell>
    );
  }

  if (appMode === 'certificate' && result) {
    return (
      <Shell>
        <TopBar onHome={() => setAppMode('analyzer')} onPlugin={() => setAppMode('plugin')} />
        <main className="max-w-7xl mx-auto px-4 py-12">
          <Certificate domain={normalizeDomain(result.url)} score={result.totalScore} eligible={result.pluginDetected} onBack={() => setAppMode('analyzer')} />
        </main>
      </Shell>
    );
  }

  const runFor = async (raw: string) => {
    let formattedUrl = raw.trim();
    if (!formattedUrl) return;
    if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;
    setUrl(formattedUrl);
    setAppState('scanning');
    setResult(null);
    try {
      const res = await runSimulatedAudit(formattedUrl, (msg) => setLoadingMsg(msg));
      setResult(res);
      setAppState('results');
      // Shareable report URL — anyone opening it re-runs the same audit live.
      window.history.replaceState(null, '', withBase('/') + '?audit=' + encodeURIComponent(normalizeDomain(formattedUrl)));
    } catch (e) {
      console.error(e);
      setAppState('idle');
    }
  };

  const startAudit = (e: FormEvent) => { e.preventDefault(); if (url) runFor(url); };

  // Deep-linked audits: /?audit=store.com auto-runs on load.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('audit');
    if (p) runFor(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => { setAppState('idle'); setUrl(''); setResult(null); window.history.replaceState(null, '', '/'); };

  return (
    <Shell>
      <TopBar
        onHome={reset}
        onPlugin={() => setAppMode('plugin')}
        onDirectory={() => setAppMode('directory')}
        rightExtra={appState === 'results' ? (
          <button onClick={reset} className="text-sm text-[var(--muted)] hover:text-white transition-colors flex items-center gap-2">
            <RefreshCw size={14} /> New audit
          </button>
        ) : null}
      />
      <main className="max-w-7xl mx-auto px-4 py-12 md:py-20">
        <AnimatePresence mode="wait">
          {appState === 'idle' && <IdleView key="idle" url={url} setUrl={setUrl} onStart={startAudit} />}
          {appState === 'scanning' && <ScanningView key="scanning" url={url} message={loadingMsg} />}
          {appState === 'results' && result && <ResultsView key="results" result={result} onCertify={() => setAppMode('certificate')} />}
        </AnimatePresence>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="ars-shell ars-aurora font-sans">{children}</div>;
}

function TopBar({ onHome, onPlugin, onDirectory, rightExtra }: { onHome: () => void, onPlugin: () => void, onDirectory?: () => void, rightExtra?: ReactNode }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(8,8,15,0.72)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={onHome}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[#0a0a12] glow" style={{ background: 'var(--grad)' }}>
            <Bot size={20} />
          </div>
          <span className="font-display font-semibold tracking-tight text-lg flex items-center gap-2">
            Agent Ready <span className="grad-text">Shop</span>
          </span>
        </div>
        <div className="flex items-center gap-5">
          {onDirectory && (
            <button onClick={onDirectory} className="text-sm text-[var(--muted)] hover:text-white transition-colors items-center gap-2 font-medium hidden sm:flex">
              <ShieldCheck size={14} /> Certified directory
            </button>
          )}
          <button onClick={onPlugin} className="text-sm btn-ghost flex items-center gap-2 px-3.5 py-1.5 font-medium">
            <LayoutTemplate size={14} /> Plugin demo
          </button>
          {rightExtra}
        </div>
      </div>
    </header>
  );
}

function IdleView({ url, setUrl, onStart }: { url: string, setUrl: (s: string) => void, onStart: (e: FormEvent) => void, key?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="max-w-3xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 chip text-[var(--muted)] text-sm font-medium mb-8">
        <Sparkles size={14} className="text-[var(--violet)]" /> The agentic commerce era is here
      </div>

      <h1 className="font-display text-4xl md:text-6xl font-semibold tracking-tight mb-6 leading-[1.05]">
        Can AI agents <span className="grad-text">buy</span> from your store?
      </h1>

      <p className="text-lg md:text-xl text-[var(--muted)] mb-10 leading-relaxed max-w-2xl mx-auto">
        Purchases are shifting from humans to machines. ChatGPT, Claude and Gemini don't click your site — they read it through backend protocols. See exactly what an agent can and can't do with your store, and get the fixes that let it <span className="text-white font-medium">read, price and buy</span> your products.
      </p>

      <form onSubmit={onStart} className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 group">
          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--faint)] group-focus-within:text-[var(--violet)] transition-colors" size={20} />
          <input type="text" placeholder="your-store.com" required value={url} onChange={e => setUrl(e.target.value)}
            className="w-full glass-flat pl-12 pr-4 py-4 text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--violet)] transition-all text-lg font-mono" />
        </div>
        <button type="submit" className="btn-grad px-8 py-4 flex items-center justify-center gap-2 text-lg">
          Start audit <ArrowRight size={20} />
        </button>
      </form>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        <FeatureCard accent="green" icon={<Cpu />} title="Structured commerce API" desc="A manifest, product API and feed agents call for live price, stock and details — no scraping." />
        <FeatureCard accent="gold" icon={<Code2 />} title="llms.txt & clean schema" desc="The context and JSON-LD that let LLMs actually read, understand and cite your catalog." />
        <FeatureCard accent="green" icon={<ShoppingBag />} title="Agentic checkout" desc="Agents price a basket and create a ready-to-pay order — a real deterministic purchase path." />
      </div>

      <div className="mt-14">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--faint)] mb-3">A WordPress plugin · deep integration with</p>
        <div className="flex flex-wrap justify-center gap-2">
          {['WooCommerce', 'Easy Digital Downloads', 'SureCart', 'Ecwid', 'WP eCommerce', 'BigCommerce'].map(p => (
            <span key={p} className="chip px-3 py-1 text-xs text-[var(--muted)]">{p}</span>
          ))}
        </div>
        <p className="text-xs text-[var(--faint)] mt-3">Certification also audits <span className="text-[var(--muted)]">Shopify, PrestaShop, Magento, Shoptet, Wix</span> & more.</p>
      </div>
    </motion.div>
  );
}

function FeatureCard({ icon, title, desc, accent = 'green' }: { icon: ReactNode, title: string, desc: string, accent?: 'green' | 'gold' }) {
  const color = accent === 'gold' ? 'var(--gold)' : 'var(--violet)';
  return (
    <div className="glass p-5 transition-colors">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center chip mb-3" style={{ color }}>{icon}</div>
      <h3 className="font-display font-medium text-white mb-1">{title}</h3>
      <p className="text-sm text-[var(--muted)] leading-relaxed">{desc}</p>
    </div>
  );
}

function ScanningView({ url, message }: { url: string, message: string, key?: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-xl mx-auto mt-16">
      <div className="glass p-10 relative overflow-hidden text-center flex flex-col items-center glow">
        <div className="relative w-20 h-20 mb-6">
          <div className="absolute inset-0 rounded-full" style={{ background: 'var(--grad)', filter: 'blur(14px)', opacity: 0.5 }} />
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--violet)] border-r-[var(--cyan)] animate-spin" style={{ animationDuration: '1.4s' }} />
          <div className="absolute inset-0 flex items-center justify-center"><Search className="text-white" size={26} /></div>
        </div>
        <h2 className="font-display text-xl font-medium mb-3">Scanning store…</h2>
        <div className="glass-flat py-2 px-4 truncate max-w-full font-mono text-sm mb-8 text-[var(--muted)]">{url}</div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mb-4">
          <motion.div className="h-full rounded-full" style={{ background: 'var(--grad)' }} initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 6, ease: 'linear' }} />
        </div>
        <p className="text-sm text-[var(--muted)] font-medium h-5 font-mono">{message || 'Connecting…'}</p>
      </div>
    </motion.div>
  );
}

function ResultsView({ result, onCertify }: { result: AuditResult, onCertify: () => void, key?: string }) {
  const [shared, setShared] = useState(false);
  const shareReport = () => {
    const link = `${absUrl('/')}?audit=${encodeURIComponent(normalizeDomain(result.url))}`;
    navigator.clipboard?.writeText(link);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };
  const score = result.totalScore;
  const level = score >= 85 ? 'gold' : score >= 60 ? 'blue' : 'critical';
  const ring = level === 'gold' ? 'var(--gold)' : level === 'blue' ? 'var(--violet)' : 'var(--rose)';
  const headline = level === 'gold' ? 'Your store is Agent Ready' : level === 'blue' ? 'Partially agent-ready' : 'Your store is invisible to AI';
  const subline = level === 'gold'
    ? 'Agents can read your catalog and transact. Claim your certificate and show the trust badge.'
    : level === 'blue'
      ? 'Agents can read your store but purchasing is not fully deterministic yet. Close the gaps below to get certified.'
      : 'Autonomous agents cannot reliably find your store or complete a purchase. Here is exactly what is missing.';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6">
      {/* Platform banner */}
      <div className="glass px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center chip text-[var(--cyan)]"><LayoutTemplate size={20} /></div>
          <div>
            <h3 className="text-xs font-medium text-[var(--faint)] uppercase tracking-wider">Detected platform</h3>
            <p className="font-display font-semibold text-white">{result.platform}</p>
          </div>
        </div>
        {result.pluginDetected ? (
          <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--emerald)] chip px-3 py-1.5 font-medium"><CheckCircle2 size={16} /><span>Plugin active</span></div>
        ) : result.isWooCommerce && (
          <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--cyan)] chip px-3 py-1.5 font-medium"><CheckCircle2 size={16} /><span>Compatible</span></div>
        )}
      </div>

      {/* Score banner */}
      <div className="glass p-6 md:p-10 flex flex-col md:flex-row items-center gap-8 glow">
        <div className="flex-shrink-0 relative w-48 h-48 flex flex-col items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <circle cx="50" cy="50" r="46" fill="none" stroke={ring} strokeWidth="7" strokeDasharray="289" strokeDashoffset={289 - (289 * score) / 100} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.5s ease-in-out', filter: `drop-shadow(0 0 6px ${ring})` }} />
          </svg>
          <div className="flex flex-col items-center relative z-10">
            <span className="font-display text-6xl font-bold tracking-tighter" style={{ color: ring }}>{score}</span>
            <span className="text-[var(--faint)] font-medium tracking-widest text-xs mt-1 uppercase">/ 100 AIO</span>
          </div>
        </div>
        <div className="flex-1 space-y-4 text-center md:text-left">
          <div className="inline-flex items-center gap-2 font-medium px-3 py-1 chip text-sm" style={{ color: ring }}>
            {level === 'gold' ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />} {level === 'gold' ? 'Certified readiness' : level === 'blue' ? 'Partial readiness' : 'Critical readiness'}
          </div>
          <h2 className="font-display text-3xl font-bold text-white">{headline}</h2>
          <p className="text-[var(--muted)] text-lg leading-relaxed"><span className="font-mono text-white">{result.url}</span> — {subline}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a href={withBase('/api/download-plugin')} className="btn-grad inline-flex items-center gap-2 px-5 py-2.5">Get the plugin — free</a>
            <button onClick={onCertify} className="btn-ghost inline-flex items-center gap-2 px-4 py-2.5 text-sm"><Award size={16} style={{ color: 'var(--gold)' }} /> {level === 'gold' ? 'View your badge' : 'Preview the badge'}</button>
            <button onClick={shareReport} className="btn-ghost inline-flex items-center gap-2 px-4 py-2.5 text-sm" style={{ color: 'var(--cyan)' }}>
              {shared ? <><Check size={15} /> Link copied</> : <><Link2 size={15} /> Share report</>}
            </button>
          </div>
        </div>
      </div>

      {/* Edge firewall finding — a store can't be agent-ready if bots get challenged */}
      {result.botBlocked && (
        <div className="glass p-5 flex items-start gap-3" style={{ borderColor: 'rgba(251,113,133,0.4)' }}>
          <ShieldAlert size={20} className="text-[var(--rose)] flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-display font-semibold text-white mb-1">Your edge firewall challenges AI agents</h4>
            <p className="text-sm text-[var(--muted)] leading-relaxed m-0">
              Our auditor was blocked or served a bot challenge — real shopping agents get the same treatment. Even a perfect agent layer is useless behind a wall: whitelist verified AI agents (GPTBot, ClaudeBot, PerplexityBot) in your WAF/CDN, then re-run this audit.
            </p>
          </div>
        </div>
      )}

      {/* Flaws first — what agents can't do yet */}
      <FlawsList checks={result.checks} productPage={result.productPage} />

      {/* Then the solution */}
      <div className="ring-grad glass p-8 relative overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 chip px-3 py-1 text-xs font-medium text-[var(--violet)] mb-4"><Zap size={13} /> The fix</div>
            <h3 className="font-display text-2xl font-bold mb-3">One plugin installs the whole <span className="grad-text">agent-commerce layer</span>.</h3>
            <p className="text-[var(--muted)] leading-relaxed mb-5">
              <span className="text-white font-medium">Agent Ready Shop</span> is a WordPress plugin that does the actual engineering: it writes and maintains your llms.txt, emits clean Product schema, exposes a structured commerce API + feed, blocks training-only crawlers, measures real AI traffic, and — on Pro — lets agents complete a purchase. The work that would otherwise take a dev sprint per store.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <a href={withBase('/api/download-plugin')} className="btn-grad px-6 py-3 flex items-center gap-2">Get the plugin — free</a>
              <button onClick={onCertify} className="btn-ghost px-5 py-3 flex items-center gap-2 text-sm"><Award size={16} style={{ color: 'var(--gold)' }} /> See the badge you earn</button>
            </div>
          </div>
          <PluginShots />
        </div>
      </div>

      {/* Plans */}
      <div className="pt-10 pb-12">
        <div className="text-center mb-8">
          <h3 className="font-display text-3xl font-bold mb-2">Free gets you <span className="grad-text">found</span>. Pro gets you <span className="grad-text-2">bought</span>.</h3>
          <p className="text-[var(--muted)] max-w-2xl mx-auto">Read-only visibility is free. Agentic checkout, advanced analytics and the verifiable certificate are Pro.</p>
        </div>
        <Pricing onSelectPro={onCertify} />
      </div>
    </motion.div>
  );
}

// Short, plain-language consequence of each failing check.
const FLAW: Record<string, string> = {
  robots: 'agents may be blocked or silently ignored',
  schema: "agents can't read your product details",
  llms: 'no context document for LLMs to cite you',
  feed: "agents can't enumerate your catalog",
  api: 'agents must scrape HTML — slow and brittle',
  agent: "agents can't complete a purchase",
};

function FlawsList({ checks, productPage }: { checks: AuditCheck[], productPage?: string | null }) {
  const failing = checks
    .filter(c => c.score < c.maxScore)
    .sort((a, b) => (b.maxScore - b.score) - (a.maxScore - a.score));
  const passing = checks.filter(c => c.score >= c.maxScore);

  return (
    <div className="glass p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl font-bold flex items-center gap-2">
          <ShieldAlert size={20} className="text-[var(--rose)]" /> {failing.length} {failing.length === 1 ? 'gap' : 'gaps'} agents hit today
        </h3>
        <span className="text-xs text-[var(--faint)] hidden sm:block">
          {productPage ? <>incl. product page audit · <span className="font-mono">{new URL(productPage).pathname.slice(0, 40)}</span></> : 'sorted by impact'}
        </span>
      </div>

      <div>
        {failing.map(c => (
          <div key={c.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
            <XCircle size={18} className="text-[var(--rose)] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-white font-medium">{c.name}</span>
              <span className="text-[var(--muted)] text-sm"> — {FLAW[c.id] || c.description}</span>
            </div>
            <span className="text-xs font-mono text-[var(--rose)] flex-shrink-0">−{c.maxScore - c.score}</span>
          </div>
        ))}
      </div>

      {passing.length > 0 && (
        <p className="mt-4 pt-3 border-t border-[var(--border)] text-sm text-[var(--muted)] flex items-start gap-2">
          <CheckCircle2 size={15} className="text-[var(--emerald)] flex-shrink-0 mt-0.5" />
          <span>Already solid: {passing.map(p => p.name).join(' · ')}</span>
        </p>
      )}
    </div>
  );
}
