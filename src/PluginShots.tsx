import React, { useEffect, useState } from 'react';
import { buildBadgeSvg } from './utils/badge';

/**
 * Auto-advancing slideshow of the plugin's admin (light WP-admin cards inside a
 * browser frame). Depicts the real screens: AIO dashboard, settings, license.
 */

// WP-admin accent for the mocked screens (the mock keeps the WordPress look).
const G = '#2271b1';

function Toggle({ on }: { on: boolean }) {
  return (
    <span style={{ width: 34, height: 19, borderRadius: 999, background: on ? G : '#c3c4c7', display: 'inline-flex', alignItems: 'center', padding: 2, flexShrink: 0 }}>
      <span style={{ width: 15, height: 15, borderRadius: '50%', background: '#fff', transform: on ? 'translateX(15px)' : 'none', transition: 'transform .2s' }} />
    </span>
  );
}

const card: React.CSSProperties = { background: '#fff', border: '1px solid #dcdcde', borderRadius: 6, padding: 12 };
const cardTitle: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, color: '#1d2327', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #f0f0f1' };

function ScreenDashboard() {
  const rows = ['AI agent access', 'llms.txt manifest', 'Read-only API', 'Agentic checkout', 'Enriched schema + feed'];
  const bars: [string, number][] = [['GPTBot', 78], ['Google-Extended', 100], ['PerplexityBot', 32], ['ClaudeBot', 14]];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={card}>
        <div style={cardTitle}>AIO score</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `conic-gradient(${G} 0turn 1turn)` }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: G, fontWeight: 700, fontSize: 18 }}>100</span><span style={{ fontSize: 7, color: '#8c8f94' }}>/100</span>
            </div>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 10.5, lineHeight: 1.7, color: '#1d2327' }}>
            {rows.map(l => <li key={l} style={{ display: 'flex', gap: 5 }}><span style={{ color: G }}>✓</span>{l}</li>)}
          </ul>
        </div>
      </div>
      <div style={card}>
        <div style={cardTitle}>AI traffic · 30 days</div>
        <div style={{ fontSize: 11, color: '#1d2327', marginBottom: 6 }}><b style={{ fontSize: 15 }}>5,834</b> hits · <span style={{ color: '#007017' }}>5,210 verified</span></div>
        {bars.map(([n, w]) => (
          <div key={n} style={{ marginBottom: 5 }}>
            <div style={{ fontSize: 9.5, color: '#50575e', fontFamily: 'monospace' }}>{n}</div>
            <div style={{ height: 6, background: '#eef1f0', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: 6, width: `${w}%`, background: G }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenSettings() {
  const rows: [string, boolean][] = [['Output Product JSON-LD', true], ['Google / XML product feed', true], ['Agentic rate limiting', true], ['Block AI training crawlers', false], ['Storefront trust badge (Pro)', true]];
  return (
    <div style={card}>
      <div style={cardTitle}>Settings</div>
      {rows.map(([l, on]) => (
        <div key={l} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f1', fontSize: 11.5, color: '#1d2327' }}>
          <span>{l}</span><Toggle on={on} />
        </div>
      ))}
    </div>
  );
}

function ScreenLicense() {
  const badge = buildBadgeSvg({ domain: 'demo-store.com', score: 100, style: 'light' });
  return (
    <div style={{ ...card, borderLeft: `3px solid ${G}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ color: '#007017', fontWeight: 700, fontSize: 12 }}>✓ Pro license active</span>
        <span style={{ fontSize: 10, color: '#50575e' }}>· Expires: Never</span>
      </div>
      <div style={{ fontSize: 11, color: '#1d2327', marginBottom: 8 }}>Your Agent Ready certificate · <code style={{ fontFamily: 'monospace', color: G }}>ARS-8F3A2C-1B9E04</code></div>
      <div style={{ background: '#0c0c14', borderRadius: 6, padding: 10, display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <div dangerouslySetInnerHTML={{ __html: badge }} />
      </div>
      <div style={{ fontSize: 9.5, color: '#50575e', fontFamily: 'monospace', background: '#f6f7f7', border: '1px solid #e2e4e7', borderRadius: 4, padding: '6px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        &lt;a href="…/verify?d=…"&gt;&lt;img src="…/api/badge?d=…"&gt;&lt;/a&gt;
      </div>
    </div>
  );
}

const SCREENS = [
  { label: 'Dashboard', el: <ScreenDashboard /> },
  { label: 'Settings', el: <ScreenSettings /> },
  { label: 'License & certificate', el: <ScreenLicense /> },
];

export function PluginShots() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI(v => (v + 1) % SCREENS.length), 3800);
    return () => clearInterval(t);
  }, [paused]);
  const go = (d: number) => setI(v => (v + d + SCREENS.length) % SCREENS.length);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="mock-frame">
        {/* frame bar in the site's own voice */}
        <div className="mock-bar">
          <span className="label">wp-admin / Agent Shop / <span style={{ color: 'var(--ink)' }}>{SCREENS[i].label}</span></span>
          <span className="label label-clay flex-shrink-0">{String(i + 1).padStart(2, '0')} / {String(SCREENS.length).padStart(2, '0')}</span>
        </div>
        {/* screen area — WordPress admin look */}
        <div style={{ position: 'relative', minHeight: 190, padding: 14, background: '#f0f0f1', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }}>
          {SCREENS.map((s, idx) => (
            <div key={s.label} style={{ position: idx === i ? 'relative' : 'absolute', inset: idx === i ? undefined : 14, opacity: idx === i ? 1 : 0, transition: 'opacity .4s', pointerEvents: idx === i ? 'auto' : 'none' }}>
              {s.el}
            </div>
          ))}
        </div>
      </div>
      {/* controls */}
      <div className="flex items-center justify-between gap-4 mt-3">
        <div className="dashes">
          {SCREENS.map((_, idx) => (
            <button key={idx} type="button" onClick={() => setI(idx)} aria-label={`Slide ${idx + 1}`} aria-current={idx === i}
              style={{ width: 26, height: 14, padding: 0, border: 0, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <i className={idx === i ? 'on' : undefined} />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => go(-1)} className="btn btn-sm" aria-label="Previous">←</button>
          <button type="button" onClick={() => go(1)} className="btn btn-sm" aria-label="Next">→</button>
        </div>
      </div>
    </div>
  );
}
