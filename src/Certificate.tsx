import React, { useMemo, useState } from 'react';
import { absUrl } from './utils/base';
import { buildCert, buildBadgeSvg } from './utils/badge';
import { useT } from './i18n';
import { Dashes, DetectLabel } from './ui';

interface CertificateProps { domain: string; score: number; eligible: boolean; onBack?: () => void; }

export function Certificate({ domain, score, eligible, onBack }: CertificateProps) {
  const { t } = useT();
  const c = t.cert;
  const [style, setStyle] = useState<'dark' | 'light'>('dark');
  const [copied, setCopied] = useState<string>('');

  const cert = useMemo(() => buildCert(domain, score), [domain, score]);

  // The server takes the score from its own audit of the domain — nothing in
  // these URLs can raise it.
  const verifyUrl = absUrl('/verify?d=' + encodeURIComponent(cert.domain));
  const badgeUrl = absUrl('/api/badge?d=' + encodeURIComponent(cert.domain) + '&style=' + style);
  const svg = useMemo(() => buildBadgeSvg({ domain: cert.domain, score: cert.score, style }), [cert, style]);

  const embedImg = `<a href="${verifyUrl}" target="_blank" rel="noopener">\n  <img src="${badgeUrl}" alt="Agent Ready" width="240" height="56">\n</a>`;
  const embedShortcode = `[agent_ready_badge style="${style}"]`;

  const copy = (key: string, text: string) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1800); };
  const downloadSvg = () => {
    const u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = document.createElement('a'); a.href = u; a.download = `agent-ready-badge-${cert.domain}.svg`; a.click(); URL.revokeObjectURL(u);
  };

  const tierTag = cert.tier === 'gold' ? 'tag tag-solid' : cert.tier === 'blue' ? 'tag tag-clay' : 'tag';

  return (
    <div className="view text-ink">
      {onBack && <button type="button" onClick={onBack} className="link mt-8">← {t.common.backToAudit}</button>}

      {/* Certificate */}
      <section className="panel panel-strong mt-8">
        <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-10 md:gap-14 p-6 pt-12 md:p-12 items-center">
          <div className="detect w-full md:w-[250px] px-5 pt-4 pb-5">
            <DetectLabel name={c.scoreLabel} />
            <div className="flex items-baseline gap-3">
              <span className="num" style={{ fontSize: 'clamp(104px, 24vw, 140px)', fontWeight: 900, lineHeight: 0.86 }}>{cert.score}</span>
              <span className="label whitespace-nowrap">/ 100</span>
            </div>
            <Dashes total={20} on={Math.round(cert.score / 5)} className="dashes-fill dashes-tight mt-4" />
          </div>
          <div className="min-w-0">
            <span className={tierTag} style={{ whiteSpace: 'normal' }}>{c.tier[cert.tier]}</span>
            <h1 className="display display-lg mt-5 mb-4">{c.title[cert.tier]}</h1>
            <p className="body max-w-[620px] mb-6" style={{ overflowWrap: 'anywhere' }}>{c.body[cert.tier](cert.domain)}</p>
            <div className="max-w-[460px]">
              <div className="kv"><span className="label label-dim">{c.audited}</span><span className="code">{cert.issued}</span></div>
              <div className="kv"><span className="label label-dim">{c.refId}</span><span className="code">{cert.certId}</span></div>
            </div>
          </div>
        </div>
        {!eligible && (
          <p className="small m-0 border-t border-line px-6 md:px-12 py-4" style={{ color: 'var(--clay2)' }}>{c.preview}</p>
        )}
      </section>

      {/* Badge studio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <section className="panel p-6">
          <h2 className="label m-0 mb-5">{c.badge}</h2>
          <div className="border border-line p-6 flex items-center justify-center mb-4 overflow-x-auto" style={{ background: style === 'dark' ? 'var(--bg3)' : 'var(--bg)' }}>
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setStyle('dark')} aria-pressed={style === 'dark'} className="btn btn-sm">{c.dark}</button>
            <button type="button" onClick={() => setStyle('light')} aria-pressed={style === 'light'} className="btn btn-sm">{c.light}</button>
            <span className="flex-1" />
            <button type="button" onClick={downloadSvg} className="btn btn-sm">↓ SVG</button>
            <a href={verifyUrl} target="_blank" rel="noopener" className="btn btn-sm">{c.verify} ↗</a>
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="label m-0 mb-5">{c.embed}</h2>
          <div className="space-y-5">
            <EmbedBlock label={c.html} value={embedImg} copied={copied === 'html'} onCopy={() => copy('html', embedImg)} />
            <EmbedBlock label={c.shortcode} value={embedShortcode} copied={copied === 'sc'} onCopy={() => copy('sc', embedShortcode)} />
            <p className="small m-0 pt-4 border-t border-line">{c.note}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmbedBlock({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  const { t } = useT();
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="label label-dim">{label}</span>
        <button type="button" onClick={onCopy} className="link">{copied ? t.common.copied : t.common.copy}</button>
      </div>
      <pre className="codeblock">{value}</pre>
    </div>
  );
}
