import React from 'react';
import { useT } from './i18n';

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <span className="font-mono text-[13px]" style={{ color: 'var(--pass)' }} aria-label="yes">✓</span>;
  if (v === false) return <span className="font-mono text-[13px] text-ink3" aria-label="no">—</span>;
  return <span className="text-[13px] text-ink2">{v}</span>;
}

export function Pricing({ onSelectPro }: { onSelectPro?: () => void }) {
  const { t } = useT();
  const p = t.pricing;
  return (
    <div className="space-y-6 text-ink">
      <div className="cells cells-2 bg-bg2">
        {/* Free */}
        <div className="cell">
          <div className="flex items-center justify-between gap-3 mb-6"><span className="label">{p.free}</span></div>
          <h3 className="display display-md mb-2">{p.freeTitle}</h3>
          <p className="small mb-6">{p.freeSub}</p>
          <div className="num text-[64px] mb-6">€0</div>
          <ul className="list-none m-0 p-0">
            {p.freeList.map(f => (
              <li key={f} className="flex gap-3 py-2 border-t border-line text-[14px] text-ink2"><span className="font-mono" style={{ color: 'var(--pass)' }} aria-hidden="true">✓</span>{f}</li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className="cell bg-bg3">
          <div className="flex items-center justify-between gap-3 mb-6">
            <span className="label label-clay">{p.pro}</span>
            <span className="tag tag-solid">{p.recommended}</span>
          </div>
          <h3 className="display display-md mb-2">{p.proTitle}</h3>
          <p className="small mb-6">{p.proSub}</p>
          <div className="mb-6 flex items-baseline gap-2"><span className="num text-[64px]">€149</span><span className="label">{p.perYear}</span></div>
          <ul className="list-none m-0 p-0">
            {p.proList.map(f => (
              <li key={f} className="flex gap-3 py-2 border-t border-line text-[14px] text-ink"><span className="font-mono text-clay" aria-hidden="true">+</span>{f}</li>
            ))}
          </ul>
          {onSelectPro && (
            <button type="button" onClick={onSelectPro} className="btn btn-primary w-full mt-6">{p.upgrade} <span aria-hidden="true">→</span></button>
          )}
        </div>
      </div>

      {/* Full comparison */}
      <div className="panel overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>{p.capability}</th>
              <th className="text-center w-[110px] sm:w-[150px]">{p.free}</th>
              <th className="text-center w-[130px] sm:w-[240px]" style={{ color: 'var(--clay2)' }}>{p.pro}</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map(r => (
              <tr key={r.label} className={r.flagship ? 'bg-bg3' : undefined}>
                <td style={{ color: 'var(--ink)' }}>
                  {r.flagship && <span className="tag tag-clay mr-2 align-middle">{p.flagship}</span>}
                  {r.label}
                </td>
                <td className="text-center"><Cell v={r.free} /></td>
                <td className="text-center"><Cell v={r.pro} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
