import React, { useState } from 'react';
import { STATIC, withBase } from './utils/base';
import { Zap, Copy, Check, Loader2, ShieldCheck } from 'lucide-react';

/**
 * Purchase flow (demo). In production the button opens a Stripe / Lemon Squeezy
 * checkout and the license is issued only after the payment webhook confirms.
 */
export function BuyPro() {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const [key, setKey] = useState('');
  const [copied, setCopied] = useState(false);

  const buy = async () => {
    setState('loading');
    try {
      const res = await fetch(withBase('/api/license/issue?plan=pro&features=*&expires=never'));
      const data = await res.json();
      if (!res.ok || !data.key) throw new Error('No license issued');
      setKey(data.key);
      setState('done');
    } catch { setState('idle'); }
  };

  const copy = () => { navigator.clipboard?.writeText(key); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  return (
    <div className="glass p-6">
      <div className="flex items-center gap-2 font-semibold mb-1 grad-text"><Zap size={16} className="text-[var(--violet)]" /> Agent Ready Shop Pro</div>
      <p className="text-[var(--muted)] text-sm mb-4">Unlock agentic checkout, advanced analytics, enriched schema, full feed and your verifiable certificate.</p>

      {state !== 'done' ? (
        <>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-display text-3xl font-bold text-white">€149</span>
            <span className="text-sm text-[var(--muted)]">/ year · 1 store</span>
          </div>
          <button onClick={buy} disabled={STATIC || state === 'loading'} className="btn-grad w-full px-4 py-2.5 flex items-center justify-center gap-2">
            {state === 'loading' ? <><Loader2 size={16} className="animate-spin" /> Processing…</> : STATIC ? <>Available soon</> : <>Complete purchase (demo)</>}
          </button>
          {!STATIC && <p className="text-xs text-[var(--faint)] mt-2 text-center">Demo issues a real, valid license key. In production this runs after payment.</p>}
        </>
      ) : (
        <div>
          <div className="flex items-center gap-2 font-semibold mb-3" style={{ color: 'var(--emerald)' }}><ShieldCheck size={18} /> Purchase complete — your license key:</div>
          <div className="flex items-center gap-2 glass-flat p-3">
            <code className="flex-1 font-mono text-[12px] break-all" style={{ color: 'var(--cyan)' }}>{key}</code>
            <button onClick={copy} className="text-[var(--muted)] hover:text-white bg-transparent border-0 cursor-pointer flex items-center gap-1 text-xs flex-shrink-0">
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
          <ol className="text-[13px] text-[var(--muted)] mt-4 pl-5 space-y-1 list-decimal">
            <li>Install the Agent Ready Shop plugin on your WooCommerce store.</li>
            <li>Go to <span className="text-white font-medium">WP Admin → Agent Shop → License</span>.</li>
            <li>Paste the key above and click <span className="text-white font-medium">Activate</span>.</li>
            <li>Your certificate is minted and the trust badge goes live.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
