import React, { useMemo, useState } from 'react';
import { ShieldCheck, Copy, Check, ExternalLink, Download, ArrowLeft, Award } from 'lucide-react';
import { buildCert, buildBadgeSvg, Tier } from './utils/badge';

interface CertificateProps { domain: string; score: number; eligible: boolean; onBack?: () => void; }

const TIER_UI: Record<Tier, { label: string; color: string }> = {
  gold: { label: 'Certified · Agent-Transacting', color: 'var(--gold)' },
  blue: { label: 'Verified · Agent-Readable', color: 'var(--violet)' },
  none: { label: 'Not yet certified', color: 'var(--faint)' },
};

export function Certificate({ domain, score, eligible, onBack }: CertificateProps) {
  const [style, setStyle] = useState<'dark' | 'light'>('dark');
  const [copied, setCopied] = useState<string>('');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://agentreadyshop.com';
  const cert = useMemo(() => buildCert(domain, score), [domain, score]);
  const ui = TIER_UI[cert.tier];

  const verifyUrl = `${origin}/verify/${cert.certId}?d=${encodeURIComponent(cert.domain)}&s=${cert.score}`;
  const badgeUrl = `${origin}/api/badge?d=${encodeURIComponent(cert.domain)}&s=${cert.score}&style=${style}`;
  const svg = useMemo(() => buildBadgeSvg({ domain: cert.domain, score: cert.score, style }), [cert, style]);

  const embedImg = `<a href="${verifyUrl}" target="_blank" rel="noopener">\n  <img src="${badgeUrl}" alt="Agent Ready Certified" width="240" height="56">\n</a>`;
  const embedShortcode = `[agent_ready_badge style="${style}"]`;

  const copy = (key: string, text: string) => { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1800); };
  const downloadSvg = () => {
    const u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const a = document.createElement('a'); a.href = u; a.download = `agent-ready-badge-${cert.domain}.svg`; a.click(); URL.revokeObjectURL(u);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {onBack && (
        <button onClick={onBack} className="text-sm text-[var(--muted)] hover:text-white flex items-center gap-2 bg-transparent border-0 cursor-pointer p-0">
          <ArrowLeft size={16} /> Back to audit
        </button>
      )}

      {/* Certificate hero */}
      <div className={`glass overflow-hidden ${cert.tier === 'gold' ? 'ring-gold glow-gold' : 'ring-grad glow'}`}>
        <div className="p-8 md:p-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative w-40 h-40 flex-shrink-0 rounded-full glass-flat flex flex-col items-center justify-center" style={{ boxShadow: `0 0 50px ${ui.color}22` }}>
              <Award size={30} style={{ color: ui.color }} />
              <span className="font-display text-4xl font-bold mt-1" style={{ color: ui.color }}>{cert.score}</span>
              <span className="text-[10px] tracking-widest text-[var(--faint)] uppercase">/ 100 AIO</span>
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 font-semibold px-3 py-1 chip text-sm mb-3" style={{ color: ui.color }}>
                <ShieldCheck size={16} /> {ui.label}
              </div>
              <h2 className="font-display text-3xl font-bold text-white mb-1">Agent Ready {cert.tier === 'gold' ? 'Certified' : cert.tier === 'blue' ? 'Verified' : 'Certificate'}</h2>
              <p className="text-[var(--muted)] leading-relaxed">This certifies that <span className="text-white font-medium">{cert.domain}</span> meets the Agent Ready Shop standard for AI-agent commerce.</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 justify-center md:justify-start text-sm text-[var(--muted)]">
                <span>ID: <code className="font-mono text-white">{cert.certId}</code></span>
                <span>Issued: {cert.issued}</span>
                <span>Valid until: {cert.validUntil}</span>
              </div>
            </div>
          </div>
        </div>
        {!eligible && (
          <div className="border-t border-[var(--border)] px-8 py-3 text-[13px]" style={{ background: 'rgba(251,191,36,0.08)', color: 'var(--amber)' }}>
            This is a preview. Activate an <span className="font-medium">Agent Ready Shop Pro</span> license in the plugin to mint the live, verifiable certificate for your store.
          </div>
        )}
      </div>

      {/* Badge studio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-6">
          <h3 className="font-display text-[15px] font-semibold text-white mb-4">Trust badge</h3>
          <div className="rounded-2xl border border-[var(--border)] p-6 flex items-center justify-center mb-4" style={{ background: style === 'dark' ? 'rgba(255,255,255,0.04)' : '#0c0c14' }}>
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setStyle('dark')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${style === 'dark' ? 'text-[#0a0a12]' : 'text-[var(--muted)] border-[var(--border)]'}`} style={style === 'dark' ? { background: 'var(--grad)', borderColor: 'transparent' } : {}}>Dark</button>
            <button onClick={() => setStyle('light')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${style === 'light' ? 'text-[#0a0a12]' : 'text-[var(--muted)] border-[var(--border)]'}`} style={style === 'light' ? { background: 'var(--grad)', borderColor: 'transparent' } : {}}>Light</button>
            <button onClick={downloadSvg} className="ml-auto btn-ghost px-3 py-1.5 text-xs font-medium flex items-center gap-1.5"><Download size={13} /> SVG</button>
            <a href={verifyUrl} target="_blank" rel="noopener" className="btn-ghost px-3 py-1.5 text-xs font-medium flex items-center gap-1.5" style={{ color: 'var(--cyan)' }}><ExternalLink size={13} /> Verify</a>
          </div>
        </div>

        <div className="glass p-6 space-y-5">
          <h3 className="font-display text-[15px] font-semibold text-white">Embed on your store</h3>
          <EmbedBlock label="HTML (any site)" value={embedImg} copied={copied === 'html'} onCopy={() => copy('html', embedImg)} />
          <EmbedBlock label="WordPress shortcode (plugin)" value={embedShortcode} copied={copied === 'sc'} onCopy={() => copy('sc', embedShortcode)} />
          <p className="text-xs text-[var(--muted)] leading-relaxed glass-flat p-3">The badge links to a public verification page that re-audits your live site — no shared database, tamper-evident.</p>
        </div>
      </div>
    </div>
  );
}

function EmbedBlock({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-[var(--muted)]">{label}</span>
        <button onClick={onCopy} className="text-xs bg-transparent border-0 cursor-pointer flex items-center gap-1" style={{ color: 'var(--cyan)' }}>
          {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
      <pre className="glass-flat text-[var(--muted)] p-3 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">{value}</pre>
    </div>
  );
}
