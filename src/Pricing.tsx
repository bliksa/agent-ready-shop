import React from 'react';
import { Check, X, Zap, ShoppingCart, BarChart3, Award, ArrowRight } from 'lucide-react';

interface Row { label: string; free: boolean | string; pro: boolean | string; flagship?: boolean; }

const ROWS: Row[] = [
  { label: 'AI crawler access (robots.txt)', free: true, pro: true },
  { label: 'llms.txt manifest', free: 'Basic', pro: 'Custom' },
  { label: 'Product JSON-LD schema', free: 'Basic', pro: 'Enriched (returns, shipping, GTIN)' },
  { label: 'Read-only Agent Commerce API + OpenAPI', free: true, pro: true },
  { label: 'Product feed', free: 'Up to 20 items', pro: 'Unlimited + Google/XML' },
  { label: 'AI traffic analytics', free: 'Basic counter', pro: 'Trends, per-product, CSV export' },
  { label: 'Agentic checkout — agents add to cart & create orders', free: false, pro: true, flagship: true },
  { label: 'Agent Ready certificate + verifiable trust badge', free: false, pro: true },
  { label: 'Automatic updates, unlimited agents, priority support', free: false, pro: true },
];

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check size={16} className="text-[var(--emerald)]" />;
  if (v === false) return <X size={16} className="text-[var(--faint)]" />;
  return <span className="text-[13px] text-[var(--muted)]">{v}</span>;
}

export function Pricing({ onSelectPro }: { onSelectPro?: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Free */}
        <div className="glass p-6">
          <div className="text-[var(--muted)] font-semibold mb-1">Free</div>
          <h3 className="font-display text-xl font-bold text-white m-0 mb-1">Get discovered</h3>
          <p className="text-sm text-[var(--muted)] mb-4">Agents can find, read and cite your store.</p>
          <div className="font-display text-4xl font-bold text-white mb-1">€0</div>
          <p className="text-xs text-[var(--faint)] mb-5">AIO score up to 50 / 100 · not certified</p>
          <ul className="list-none m-0 p-0 space-y-2 text-[13px] text-[var(--muted)]">
            {['AI crawler access', 'llms.txt manifest', 'Basic Product schema', 'Read-only product API'].map(f => (
              <li key={f} className="flex items-center gap-2"><Check size={15} className="text-[var(--emerald)]" /> {f}</li>
            ))}
          </ul>
        </div>

        {/* Pro */}
        <div className="ring-grad glass p-6 relative glow">
          <span className="absolute -top-3 left-6 text-xs font-semibold px-3 py-1 rounded-full text-[#2a1e02]" style={{ background: 'var(--grad-gold)' }}>Recommended</span>
          <div className="font-semibold mb-1 flex items-center gap-2 grad-text"><Zap size={15} className="text-[var(--violet)]" /> Pro</div>
          <h3 className="font-display text-xl font-bold text-white m-0 mb-1">Get bought</h3>
          <p className="text-sm text-[var(--muted)] mb-4">Agents transact, you measure it, shoppers trust it.</p>
          <div className="font-display text-4xl font-bold text-white mb-1">€149<span className="text-sm font-normal text-[var(--muted)]">/yr</span></div>
          <p className="text-xs text-[var(--faint)] mb-5">AIO score up to 100 / 100 · Agent Ready Certified</p>
          <ul className="list-none m-0 p-0 space-y-2 text-[13px]">
            <li className="flex items-center gap-2 font-semibold text-white"><ShoppingCart size={15} className="text-[var(--violet)]" /> Agentic checkout (cart & order API)</li>
            <li className="flex items-center gap-2 font-semibold text-white"><BarChart3 size={15} className="text-[var(--violet)]" /> Advanced AI analytics + export</li>
            <li className="flex items-center gap-2 text-[var(--muted)]"><Check size={15} className="text-[var(--emerald)]" /> Enriched schema + full Google/XML feed</li>
            <li className="flex items-center gap-2 font-semibold text-white"><Award size={15} style={{ color: 'var(--gold)' }} /> Certificate + verifiable trust badge</li>
          </ul>
          {onSelectPro && (
            <button onClick={onSelectPro} className="btn-grad mt-5 w-full px-4 py-2.5 flex items-center justify-center gap-2">Upgrade to Pro <ArrowRight size={16} /></button>
          )}
        </div>
      </div>

      {/* Full comparison */}
      <div className="glass overflow-hidden">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-white">
              <th className="py-3 px-4 font-semibold">Capability</th>
              <th className="py-3 px-4 font-semibold text-center w-[140px]">Free</th>
              <th className="py-3 px-4 font-semibold text-center w-[220px] grad-text">Pro</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(r => (
              <tr key={r.label} className="border-b border-[var(--border)]" style={r.flagship ? { background: 'rgba(139,124,255,0.08)' } : undefined}>
                <td className="py-3 px-4 text-[var(--text)]">
                  {r.flagship && <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mr-2 align-middle text-[#0a0a12]" style={{ background: 'var(--grad-2)' }}>Flagship</span>}
                  {r.label}
                </td>
                <td className="py-3 px-4 text-center"><div className="flex justify-center"><Cell v={r.free} /></div></td>
                <td className="py-3 px-4 text-center"><div className="flex justify-center"><Cell v={r.pro} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
