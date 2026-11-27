import React, { useState } from 'react';
import { STATIC, withBase } from './utils/base';
import { useT } from './i18n';

/**
 * Pro purchase panel.
 * - Static build: there is no payment gateway yet, so nothing can be bought — say so.
 * - Node dev build: a clearly labelled demo that issues a test licence key.
 */
export function BuyPro() {
  const { t } = useT();
  const b = t.buy;
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
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
    } catch { setState('failed'); }
  };

  const copy = () => { navigator.clipboard?.writeText(key); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  return (
    <div className="panel p-6 text-ink">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="label label-clay">{b.title}</span>
        {!STATIC && <span className="tag tag-clay">{b.demoTag}</span>}
      </div>
      <p className="small mb-5 max-w-[640px]">{b.sub}</p>

      {state !== 'done' ? (
        <>
          <div className="flex items-baseline gap-3 mb-5">
            <span className="num text-[56px]">€149</span>
            <span className="label">{b.perYearStore}</span>
          </div>
          {STATIC ? (
            <div className="notice">
              <p className="label m-0 mb-1" style={{ color: 'var(--ink)' }}>{b.notOnSale}</p>
              <p className="small m-0">{b.notOnSaleBody}</p>
              <a href={withBase('/api/download-plugin')} className="btn mt-4">{t.common.getPlugin}</a>
            </div>
          ) : (
            <>
              <button type="button" onClick={buy} disabled={state === 'loading'} className="btn btn-primary w-full">
                {state === 'loading' ? b.processing : b.demoButton}
              </button>
              <p className="small mt-3 mb-0" style={{ color: 'var(--ink3)' }}>{b.demoNote}</p>
              {state === 'failed' && <p role="alert" className="small mt-2 mb-0" style={{ color: 'var(--fail)' }}>{b.demoFailed}</p>}
            </>
          )}
        </>
      ) : (
        <div>
          <p className="label mb-3" style={{ color: 'var(--pass)' }}>{b.done}</p>
          <div className="inset p-3 flex items-start gap-3">
            <code className="code flex-1 text-[12px] break-all">{key}</code>
            <button type="button" onClick={copy} className="btn btn-sm flex-shrink-0">{copied ? t.common.copied : t.common.copy}</button>
          </div>
          <ol className="small mt-4 mb-0 pl-5 space-y-1 list-decimal">
            {b.steps.map(s => <li key={s}>{s}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
