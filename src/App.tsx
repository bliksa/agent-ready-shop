/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, FormEvent, ReactNode, Suspense, lazy } from 'react';
import { absUrl, withBase, STATIC } from './utils/base';
import { runAudit, AuditError, AuditErrorKind, AUDIT_STEPS, baseChecks, checkCopy } from './data/auditConfig';
import { AuditResult, AuditCheck } from './types';
import { PluginDashboard } from './PluginDashboard';
import { Certificate } from './Certificate';
import { Pricing } from './Pricing';
import { Directory } from './Directory';
import { PluginShots } from './PluginShots';
import { normalizeDomain } from './utils/badge';
import { useT } from './i18n';
import { SectionHead, Dashes, DetectLabel, Logo, useReveal } from './ui';
import heroImage from './assets/claudia-chrome.webp';

// Internal vendor tool: only the Node build ships it. The literal env check lets
// Vite drop the whole chunk from static builds.
const LicenseGenerator = import.meta.env.VITE_STATIC !== '1'
  ? lazy(() => import('./LicenseGenerator').then(m => ({ default: m.LicenseGenerator })))
  : null;

type Mode = 'analyzer' | 'plugin' | 'certificate' | 'directory' | 'generator';

export default function App() {
  const [appMode, setAppMode] = useState<Mode>(
    !STATIC && LicenseGenerator && typeof window !== 'undefined' && window.location.hash === '#generator' ? 'generator' : 'analyzer'
  );
  const [url, setUrl] = useState('');
  const [appState, setAppState] = useState<'idle' | 'scanning' | 'results'>('idle');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<AuditErrorKind | null>(null);

  const runFor = async (raw: string) => {
    let formattedUrl = raw.trim();
    if (!formattedUrl) return;
    if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;
    setUrl(formattedUrl);
    setAppState('scanning');
    setStep(0);
    setResult(null);
    setError(null);
    try {
      const res = await runAudit(formattedUrl, setStep);
      setResult(res);
      setAppState('results');
      window.scrollTo(0, 0);
      // Shareable report URL — anyone opening it re-runs the same audit live.
      window.history.replaceState(null, '', withBase('/') + '?audit=' + encodeURIComponent(normalizeDomain(formattedUrl)));
    } catch (e) {
      console.error(e);
      setError(e instanceof AuditError ? e.kind : 'server');
      setAppState('idle');
    }
  };

  // Deep-linked audits: /?audit=store.com auto-runs on load.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('audit');
    if (p) runFor(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAudit = (e: FormEvent) => { e.preventDefault(); if (url) runFor(url); };
  const reset = () => {
    setAppMode('analyzer'); setAppState('idle'); setUrl(''); setResult(null); setError(null);
    window.history.replaceState(null, '', withBase('/'));
    window.scrollTo(0, 0);
  };
  const go = (m: Mode) => { setAppMode(m); window.scrollTo(0, 0); };

  if (appMode === 'plugin') {
    return <PluginDashboard onExit={() => go('analyzer')} />;
  }

  const bar = (
    <TopBar
      onHome={appMode === 'analyzer' ? reset : () => go('analyzer')}
      onPlugin={() => go('plugin')}
      onDirectory={() => go('directory')}
      onNewAudit={appMode === 'analyzer' && appState === 'results' ? reset : undefined}
    />
  );

  let body: ReactNode;
  if (appMode === 'directory') {
    body = <Directory onBack={() => go('analyzer')} />;
  } else if (appMode === 'generator' && LicenseGenerator) {
    body = <Suspense fallback={null}><LicenseGenerator onBack={() => go('analyzer')} /></Suspense>;
  } else if (appMode === 'certificate' && result) {
    body = <Certificate domain={normalizeDomain(result.url)} score={result.totalScore} eligible={result.pluginDetected} onBack={() => go('analyzer')} />;
  } else if (appState === 'scanning') {
    body = <ScanningView url={url} step={step} />;
  } else if (appState === 'results' && result) {
    body = <ResultsView result={result} onCertify={() => go('certificate')} />;
  } else {
    body = <IdleView url={url} setUrl={setUrl} onStart={startAudit} error={error} />;
  }

  return (
    <div className="shell">
      {bar}
      <main className="wrap pb-24">{body}</main>
      <Footer />
    </div>
  );
}

function TopBar({ onHome, onPlugin, onDirectory, onNewAudit }: { onHome: () => void; onPlugin: () => void; onDirectory: () => void; onNewAudit?: () => void }) {
  const { t } = useT();
  const links = (
    <>
      <button type="button" onClick={onDirectory} className="nav-link">{t.nav.directory}</button>
      <button type="button" onClick={onPlugin} className="nav-link">{t.nav.plugin}</button>
      {onNewAudit && <button type="button" onClick={onNewAudit} className="nav-link" style={{ color: 'var(--clay2)' }}>{t.nav.newAudit}</button>}
    </>
  );
  return (
    <header className="topbar">
      <div className="wrap">
        <div className="topbar-row">
          <button type="button" className="wordmark" onClick={onHome} aria-label={t.nav.home}>
            <Logo />
            <span className="wordmark-tld">Agent Ready</span>
          </button>
          <div className="nav">
            <nav className="hidden md:flex items-center gap-[26px]">{links}</nav>
          </div>
        </div>
        <nav className="subnav md:hidden">{links}</nav>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useT();
  return (
    <footer className="border-t border-line">
      <div className="wrap py-7 flex flex-wrap items-center justify-between gap-4">
        <span className="label label-dim">
          <Logo className="logo-sm" /> · Agent Ready Shop
          <a className="footer-credit" href="https://claudia.gallery/" target="_blank" rel="noopener">{t.hero.credit}</a>
        </span>
        <a href={withBase('/api/download-plugin')} className="link">{t.common.getPlugin}</a>
      </div>
    </footer>
  );
}

const FLAP_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const FLAP_TICK_MS = 70;

/** Split-flap board. On load every tile runs through the alphabet in order and
 *  drops onto its letter, left to right, like a departures board updating. */
function Flaps({ text }: { text: string }) {
  const still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const letters = text.replace(/ /g, '').length;
  const lastTick = 6 + (letters - 1) * 2;
  const [tick, setTick] = useState(still ? lastTick : 0);

  useEffect(() => {
    if (tick >= lastTick) return;
    const id = window.setTimeout(() => setTick(n => n + 1), FLAP_TICK_MS);
    return () => window.clearTimeout(id);
  }, [tick, lastTick]);

  let index = 0;
  return (
    <div className="flaps" role="img" aria-label={text}>
      {text.split(' ').map((w, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="flap-slash" aria-hidden="true">/</span>}
          <span className="flap-word" aria-hidden="true">
            {w.split('').map((ch, j) => {
              const remaining = Math.max(0, 6 + index++ * 2 - tick); // ticks until this tile lands
              const at = FLAP_ALPHABET.indexOf(ch);
              const shown = remaining && at >= 0 ? FLAP_ALPHABET[(at - remaining + 260) % 26] : ch;
              return (
                <span className="flap" key={j}>
                  <span key={shown + remaining} className={`flap-ch ${remaining ? 'is-flipping' : still ? '' : 'is-landed'}`}>{shown}</span>
                </span>
              );
            })}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function IdleView({ url, setUrl, onStart, error }: { url: string; setUrl: (s: string) => void; onStart: (e: FormEvent) => void; error: AuditErrorKind | null }) {
  const { t, lang } = useT();
  const checks = useReveal<HTMLElement>();
  return (
    <div className="view">
      {/* Hero */}
      <section className="hero">
        <div className="hero-bg" style={{ backgroundImage: `url(${heroImage})` }} aria-hidden="true" />
        <Flaps text="AGENT READY" />
        <h1 className="display display-md hero-title mt-8 md:mt-11 mb-5">{t.hero.title}</h1>
        <div className="max-w-[620px]">
          <p className="lead hero-lead mb-8">
            {t.hero.leadA}<span className="hi whitespace-nowrap">{t.hero.leadHi}</span>{t.hero.leadB}
          </p>

          <form onSubmit={onStart}>
            <label htmlFor="store-url" className="label block mb-2">{t.hero.urlLabel}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input id="store-url" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} required
                placeholder={t.hero.placeholder} value={url} onChange={e => setUrl(e.target.value)}
                aria-invalid={error ? true : undefined} aria-describedby={error ? 'audit-error' : undefined}
                className="field flex-1 min-w-0" />
              <button type="submit" className="btn btn-primary sm:min-h-[54px] sm:px-7">{t.hero.start} <span aria-hidden="true">→</span></button>
            </div>
            {error && (
              <div id="audit-error" role="alert" className="notice mt-3">
                <p className="label mb-1" style={{ color: 'var(--clay2)' }}>{t.errors.title}</p>
                <p className="small m-0" style={{ color: 'var(--ink)' }}>{t.errors[error]}</p>
              </div>
            )}
          </form>
        </div>
      </section>

      {/* The rubric: six checks, in the order an agent needs them */}
      <section ref={checks.ref} className={`sec reveal${checks.shown ? ' is-in' : ''}`}>
        <SectionHead title={t.checksSection.title} />
        <ol className="rows list-none m-0 p-0">
          {baseChecks.map((c, i) => {
            const copy = checkCopy(lang, c.id);
            return (
              <li className="row" key={c.id} style={{ '--i': i } as React.CSSProperties}>
                <span className="row-num" aria-hidden="true">{i + 1}</span>
                <h3 className="m-0 text-[17px] leading-snug font-bold text-ink">{copy.name}</h3>
                <p className="body m-0 col-start-2 lg:col-start-auto">{copy.description}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The plugin */}
      <section className="sec chrome-band">
        <SectionHead title={t.features.title} />
        <div className="cells cells-3">
          {t.features.items.map(f => (
            <div className="cell" key={f.title}>
              <h3 className="display display-sm mb-3">{f.title}</h3>
              <p className="body m-0">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
          <a href={withBase('/api/download-plugin')} className="btn btn-primary">{t.common.getPlugin}</a>
          <p className="small m-0">{t.features.note}</p>
        </div>
      </section>
    </div>
  );
}

function ScanningView({ url, step }: { url: string; step: number }) {
  const { t } = useT();
  return (
    <div className="view pt-12 md:pt-20 max-w-[820px]">
      <h1 className="display display-xl mb-12">{t.scan.title}</h1>
      <div className="detect px-4 py-4 mb-8">
        <DetectLabel name={t.scan.target} />
        <span className="code text-[15px] sm:text-[17px] block truncate">{url}</span>
      </div>
      <Dashes total={AUDIT_STEPS} on={step} running={step} className="dashes-fill mb-4" />
      <p className="label min-h-[2.4em]" style={{ color: 'var(--ink)' }} role="status" aria-live="polite">{t.scan.steps[step] || t.scan.steps[0]}</p>
    </div>
  );
}

function ResultsView({ result, onCertify }: { result: AuditResult; onCertify: () => void }) {
  const { t } = useT();
  const [shared, setShared] = useState(false);
  const domain = normalizeDomain(result.url);
  const shareReport = () => {
    const link = `${absUrl('/')}?audit=${encodeURIComponent(domain)}`;
    navigator.clipboard?.writeText(link);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };
  const score = result.totalScore;
  const level = score >= 85 ? 'gold' : score >= 60 ? 'blue' : 'critical';

  return (
    <div className="view">
      {/* Platform strip */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pt-8 pb-5 border-b border-line">
        <div className="min-w-0">
          <p className="label label-dim m-0 mb-1">{t.results.platform}</p>
          <p className="display display-sm m-0">{result.platform}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="code text-[13px] mr-2">{domain}</span>
          {result.pluginDetected
            ? <span className="tag tag-pass">{t.results.pluginActive}</span>
            : result.isWooCommerce && <span className="tag">{t.results.compatible}</span>}
        </div>
      </div>

      {/* Score */}
      <section className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] gap-10 lg:gap-16 pt-14 lg:pt-16 items-center">
        <div className="detect w-full sm:w-[340px] px-6 pt-5 pb-6">
          <DetectLabel name={t.results.scoreLabel} />
          <div className="flex items-baseline gap-3">
            <span className="num" style={{ fontSize: 'clamp(132px, 30vw, 200px)', fontWeight: 900, lineHeight: 0.86 }}>{score}</span>
            <span className="label whitespace-nowrap">/ 100</span>
          </div>
          <Dashes total={20} on={Math.round(score / 5)} className="dashes-fill dashes-tight mt-5" />
        </div>
        <div className="min-w-0">
          <h1 className="display display-lg mb-5">{t.results.headline[level]}</h1>
          <p className="lead max-w-[640px] mb-7" style={{ color: 'var(--ink2)' }}>{t.results.subline[level]}</p>
          <div className="flex flex-wrap items-center gap-2">
            <a href={withBase('/api/download-plugin')} className="btn btn-primary">{t.common.getPlugin}</a>
            <button type="button" onClick={onCertify} className="btn">{level === 'gold' ? t.results.viewBadge : t.results.previewBadge}</button>
            <button type="button" onClick={shareReport} className="btn">{shared ? t.results.linkCopied : t.results.share}</button>
          </div>
        </div>
      </section>

      {/* Edge firewall finding — a store can't be agent-ready if bots get challenged */}
      {result.botBlocked && (
        <div className="notice mt-12">
          <h2 className="label m-0 mb-2" style={{ color: 'var(--clay2)' }}>{t.results.blockedTitle}</h2>
          <p className="small m-0 max-w-[860px]">{t.results.blockedBody}</p>
        </div>
      )}

      {/* 01 — what agents hit */}
      <ChecksList checks={result.checks} />

      {/* The fix */}
      <section className="sec chrome-band">
        <SectionHead title={t.results.fixEyebrow} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            <h3 className="display display-md mb-5">{t.results.fixTitle}</h3>
            <p className="body mb-7">{t.results.fixBody}</p>
            <a href={withBase('/api/download-plugin')} className="btn btn-primary">{t.common.getPlugin}</a>
          </div>
          <PluginShots />
        </div>
      </section>

      {/* 03 — plans */}
      <section className="sec">
        <SectionHead title={t.results.plansEyebrow} />
        <p className="display display-md mb-9 max-w-[900px]">{t.results.plansTitle}</p>
        <Pricing onSelectPro={onCertify} />
      </section>
    </div>
  );
}

function ChecksList({ checks }: { checks: AuditCheck[] }) {
  const { t, lang } = useT();
  const failing = checks.filter(c => c.score < c.maxScore).sort((a, b) => (b.maxScore - b.score) - (a.maxScore - a.score));
  const passing = checks.filter(c => c.score >= c.maxScore);

  const row = (c: AuditCheck) => {
    const copy = checkCopy(lang, c.id);
    const ok = c.score >= c.maxScore;
    const status = ok ? 'pass' : c.score > 0 ? 'partial' : 'fail';
    return (
      <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[110px_minmax(0,1fr)_230px] gap-x-6 gap-y-2 py-5 border-b border-line items-start">
        <div className="order-2 lg:order-none justify-self-end lg:justify-self-start">
          <span className={`tag ${ok ? 'tag-pass' : status === 'fail' ? 'tag-fail' : 'tag-clay'}`}>{t.results[status]}</span>
        </div>
        <div className="order-1 lg:order-none min-w-0">
          <h3 className="m-0 text-[17px] leading-snug font-bold text-ink">{copy.name}</h3>
          {ok
            ? <p className="small m-0 mt-1" style={{ color: 'var(--ink3)' }}>{copy.description}</p>
            : <>
                <p className="body m-0 mt-1">{copy.flaw.charAt(0).toUpperCase() + copy.flaw.slice(1)}.</p>
                <p className="small m-0 mt-2"><span className="label label-clay mr-2">{t.results.fixLabel}</span>{copy.howToFix}</p>
              </>}
        </div>
        <div className="order-3 lg:order-none col-span-2 lg:col-span-1 lg:text-right">
          <span className="font-mono text-[11.5px] text-ink">{copy.short}</span>
          <Dashes total={10} on={Math.round((c.score / c.maxScore) * 10)} className="dashes-fill dashes-tight mt-2 lg:ml-auto lg:max-w-[230px]" />
        </div>
      </div>
    );
  };

  return (
    <section className="sec">
      <SectionHead title={t.results.gapsTitle(failing.length)} />
      <div className="border-t border-line">
        {failing.map(row)}
      </div>
      {passing.length > 0 && (
        <>
          <p className="label label-dim mt-9 mb-3">{t.results.solid}</p>
          <div className="border-t border-line">{passing.map(row)}</div>
        </>
      )}
    </section>
  );
}
