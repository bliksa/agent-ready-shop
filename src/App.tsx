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
import { useT, LANGS } from './i18n';
import { SectionHead, Dashes, DetectLabel, ratio } from './ui';

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

function LangSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <div className="lang" role="group" aria-label={t.nav.language}>
      {LANGS.map(l => (
        <button key={l} type="button" lang={l} aria-pressed={l === lang} onClick={() => setLang(l)}>{l}</button>
      ))}
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
            <span className="wordmark-name">Agent Ready</span>
            <span className="wordmark-tld">.Shop</span>
          </button>
          <div className="nav">
            <nav className="hidden md:flex items-center gap-[26px]">{links}</nav>
            <LangSwitch />
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
        <span className="label label-dim">Agent Ready Shop · AIO audit</span>
        <a href={withBase('/api/download-plugin')} className="link">{t.common.getPlugin}</a>
      </div>
    </footer>
  );
}

function Flaps({ text }: { text: string }) {
  return (
    <div className="flaps" aria-hidden="true">
      {text.split(' ').map((w, i) => (
        <span className="flap-word" key={i}>
          {w.split('').map((ch, j) => <span className="flap" key={j}>{ch}</span>)}
        </span>
      ))}
    </div>
  );
}

function IdleView({ url, setUrl, onStart, error }: { url: string; setUrl: (s: string) => void; onStart: (e: FormEvent) => void; error: AuditErrorKind | null }) {
  const { t, lang } = useT();
  return (
    <div className="view">
      {/* Hero */}
      <section className="pt-10 md:pt-16">
        <p className="label mb-5 md:mb-7"><span className="label-clay">00</span>&nbsp;&nbsp;{t.hero.eyebrow}</p>
        <div className="flex items-end justify-between gap-8">
          <Flaps text="AGENT READY" />
          <div className="hidden lg:flex flex-col items-end gap-1 pb-1 flex-shrink-0">
            {t.hero.meta.map(m => <span key={m} className="label">{m}</span>)}
            <Dashes total={8} on={1} className="mt-3" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] gap-12 lg:gap-16 mt-8 md:mt-11 items-start">
          <div>
            <h1 className="display display-md mb-5">{t.hero.title}</h1>
            <p className="lead max-w-[620px] mb-8">
              {t.hero.leadA}<span className="hi">{t.hero.leadHi}</span>{t.hero.leadB}
            </p>

            <form onSubmit={onStart} className="max-w-[620px]">
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

          <HeroFigure caption={t.hero.figCaption} />
        </div>
      </section>

      {/* 01 — the rubric */}
      <section className="sec">
        <SectionHead num="01" title={t.checksSection.title} meta={t.checksSection.eyebrow} />
        <div className="rows">
          {baseChecks.map((c, i) => {
            const copy = checkCopy(lang, c.id);
            return (
              <div className="row" key={c.id}>
                <span className="row-num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="m-0 text-[17px] leading-snug font-bold text-ink">{copy.name}</h3>
                <p className="body m-0 col-start-2 lg:col-start-auto">{copy.description}</p>
                <span className="label col-start-2 lg:col-start-auto lg:text-right whitespace-nowrap">{t.checksSection.max} {c.maxScore} {t.common.points}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 02 — the plugin */}
      <section className="sec">
        <SectionHead num="02" title={t.features.title} meta={t.features.eyebrow} />
        <div className="cells cells-3">
          {t.features.items.map((f, i) => (
            <div className="cell" key={f.title}>
              <span className="row-num block mb-8">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="display display-sm mb-3">{f.title}</h3>
              <p className="body m-0">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 lg:gap-8 items-start">
          <p className="label label-dim m-0 pt-1">{t.features.platformsLabel}</p>
          <div>
            <div className="flex flex-wrap gap-2">
              {['WooCommerce', 'Easy Digital Downloads', 'SureCart', 'Ecwid', 'WP eCommerce', 'BigCommerce'].map(p => <span key={p} className="tag">{p}</span>)}
            </div>
            <p className="small mt-4 mb-6">{t.features.alsoAudits}</p>
            <a href={withBase('/api/download-plugin')} className="btn">{t.common.getPlugin}</a>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Stylised product page as an agent sees it. Labels are schema.org property names; the figures are illustrative. */
function HeroFigure({ caption }: { caption: string }) {
  return (
    <figure className="panel m-0 p-5 sm:p-7">
      <div className="flex justify-between gap-4 label label-dim mb-9">
        <span>GET /product</span><span>200 · text/html</span>
      </div>
      <div className="grid grid-cols-[minmax(0,42%)_minmax(0,1fr)] gap-5 sm:gap-7" aria-hidden="true">
        <div className="detect aspect-[4/5] bg-bg3 overflow-visible">
          <DetectLabel name="image" value="0.94" />
          <svg viewBox="0 0 100 125" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <path d="M0 0L100 125M100 0L0 125" stroke="rgba(236,233,226,.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" fill="none" />
          </svg>
        </div>
        <div className="flex flex-col gap-8 min-w-0">
          <div className="detect detect-dim p-2.5">
            <DetectLabel name="name" value="0.98" />
            <span className="block h-2 bg-bg4 mb-2" /><span className="block h-2 bg-bg4 w-2/3" />
          </div>
          <div className="detect p-2.5 w-fit max-w-full flex items-baseline gap-2">
            <DetectLabel name="offers.price" value="0.97" />
            <span className="num text-[40px]">49.00</span><span className="label">EUR</span>
          </div>
          <div className="detect detect-dim px-2.5 py-2 w-fit max-w-full">
            <DetectLabel name="availability" value="0.91" />
            <span className="label" style={{ color: 'var(--ink)' }}>InStock</span>
          </div>
          <div className="detect detect-dim p-2.5" style={{ borderStyle: 'dashed' }}>
            <DetectLabel name="checkout" value="0.08" />
            <span className="block h-7 border border-line" />
          </div>
        </div>
      </div>
      <figcaption className="label label-dim mt-7 pt-4 border-t border-line">{caption}</figcaption>
    </figure>
  );
}

function ScanningView({ url, step }: { url: string; step: number }) {
  const { t } = useT();
  return (
    <div className="view pt-12 md:pt-20 max-w-[820px]">
      <p className="label mb-4"><span className="label-clay">{String(step + 1).padStart(2, '0')} / {String(AUDIT_STEPS).padStart(2, '0')}</span></p>
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
  const levelTag = level === 'gold' ? 'tag tag-solid' : level === 'blue' ? 'tag tag-clay' : 'tag tag-fail';

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
          <DetectLabel name={t.results.scoreLabel} value={(score / 100).toFixed(2)} />
          <div className="flex items-baseline gap-3">
            <span className="num" style={{ fontSize: 'clamp(132px, 30vw, 200px)', fontWeight: 900, lineHeight: 0.86 }}>{score}</span>
            <span className="label whitespace-nowrap">/ 100 AIO</span>
          </div>
          <Dashes total={20} on={Math.round(score / 5)} className="dashes-fill dashes-tight mt-5" />
        </div>
        <div className="min-w-0">
          <span className={levelTag}>{t.results.level[level]}</span>
          <h1 className="display display-lg mt-5 mb-5">{t.results.headline[level]}</h1>
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
      <ChecksList checks={result.checks} productPage={result.productPage} />

      {/* 02 — the fix */}
      <section className="sec">
        <SectionHead num="02" title={t.results.fixEyebrow} meta="WordPress plugin" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          <div>
            <h3 className="display display-md mb-5">{t.results.fixTitle}</h3>
            <p className="body mb-7"><span className="text-ink font-bold">{t.results.fixBodyA}</span>{t.results.fixBodyB}</p>
            <div className="flex flex-wrap gap-2">
              <a href={withBase('/api/download-plugin')} className="btn btn-primary">{t.common.getPlugin}</a>
              <button type="button" onClick={onCertify} className="btn">{t.results.seeBadge}</button>
            </div>
          </div>
          <PluginShots />
        </div>
      </section>

      {/* 03 — plans */}
      <section className="sec">
        <SectionHead num="03" title={t.results.plansEyebrow} meta={t.results.plansSub} />
        <p className="display display-md mb-9 max-w-[900px]">{t.results.plansTitle}</p>
        <Pricing onSelectPro={onCertify} />
      </section>
    </div>
  );
}

function ChecksList({ checks, productPage }: { checks: AuditCheck[]; productPage?: string | null }) {
  const { t, lang } = useT();
  const failing = checks.filter(c => c.score < c.maxScore).sort((a, b) => (b.maxScore - b.score) - (a.maxScore - a.score));
  const passing = checks.filter(c => c.score >= c.maxScore);
  let productPath = '';
  if (productPage) { try { productPath = new URL(productPage).pathname.slice(0, 40); } catch { /* not a URL */ } }

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
          <div className="flex lg:justify-end items-baseline gap-3 font-mono text-[11.5px]">
            <span className="text-ink">{copy.short} <span style={{ color: ok ? 'var(--pass)' : 'var(--clay2)' }}>{ratio(c.score, c.maxScore)}</span></span>
            <span className="text-ink3">{c.score}/{c.maxScore}</span>
          </div>
          <Dashes total={10} on={Math.round((c.score / c.maxScore) * 10)} className="dashes-fill dashes-tight mt-2 lg:ml-auto lg:max-w-[230px]" />
        </div>
      </div>
    );
  };

  return (
    <section className="sec">
      <SectionHead num="01" title={t.results.gapsTitle(failing.length)}
        meta={productPath ? <>{t.results.inclProductPage}<br /><span className="normal-case tracking-normal">{productPath}</span></> : t.results.sortedByImpact} />
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
