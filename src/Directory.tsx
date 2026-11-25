import React, { useMemo, useState } from 'react';
import { Search, ExternalLink, ShieldCheck, ArrowLeft, Radar, Award } from 'lucide-react';

interface WildStore {
  domain: string;
  score: number;
  platform: string;
  passed: string[];
}

// Real results from the batch analyzer (scripts/audit-batch.mjs, July 2026).
// Nobody reaches GOLD (85+) yet — the deterministic agent layer is missing
// everywhere. That IS the market gap this product exists for.
const WILD: WildStore[] = [
  { domain: 'gymbeam.sk', score: 75, platform: 'Magento', passed: ['robots', 'schema', 'llms', 'api'] },
  { domain: 'colourpop.com', score: 67, platform: 'Shopify', passed: ['robots', 'schema', 'feed', 'api'] },
  { domain: 'brooklinen.com', score: 67, platform: 'Shopify', passed: ['robots', 'schema', 'feed', 'api'] },
  { domain: 'kith.com', score: 67, platform: 'WordPress', passed: ['robots', 'schema', 'feed', 'api'] },
  { domain: 'dedoles.sk', score: 67, platform: 'Shopify', passed: ['robots', 'schema', 'feed', 'api'] },
  { domain: 'gymshark.com', score: 53, platform: 'Shopify', passed: ['schema', 'feed', 'api'] },
  { domain: 'allbirds.com', score: 53, platform: 'Shopify', passed: ['schema', 'feed', 'api'] },
  { domain: 'muziker.sk', score: 47, platform: 'Magento', passed: ['llms'] },
  { domain: 'mejuri.com', score: 45, platform: 'Shopify', passed: ['robots', 'schema'] },
  { domain: 'notino.sk', score: 38, platform: 'Magento', passed: ['schema'] },
];

const CHECK_LABEL: Record<string, string> = {
  robots: 'AI policy', schema: 'schema', llms: 'llms.txt', feed: 'feed', api: 'API', agent: 'agent layer',
};

function tierOf(score: number) {
  if (score >= 85) return { label: 'Gold', color: 'var(--gold)' };
  if (score >= 60) return { label: 'Verified-grade', color: 'var(--violet)' };
  return { label: '—', color: 'var(--faint)' };
}

export function Directory({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => WILD.filter(s => (s.domain + s.platform).toLowerCase().includes(q.toLowerCase())), [q]);

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={onBack} className="text-sm text-[var(--muted)] hover:text-white flex items-center gap-2 bg-transparent border-0 cursor-pointer p-0 mb-6"><ArrowLeft size={16} /> Back</button>

      {/* Certified registry — honest empty state */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 chip-gold px-3 py-1 text-sm font-medium mb-4"><ShieldCheck size={16} /> Agent Ready Certified</div>
        <h1 className="font-display text-4xl font-bold mb-2">The certified store <span className="grad-text-gold">registry</span></h1>
        <p className="text-[var(--muted)] max-w-2xl mx-auto mb-5">The registry lists stores with a live-verified Agent Ready certificate. It just opened — the first certified stores claim the top spots permanently.</p>
        <a href="/api/download-plugin" className="btn-grad inline-flex items-center gap-2 px-5 py-2.5"><Award size={16} /> Be the first — get certified</a>
      </div>

      {/* Wild leaderboard — real audit data */}
      <div className="flex items-center gap-2 mb-1">
        <Radar size={18} className="text-[var(--violet)]" />
        <h2 className="font-display text-2xl font-bold m-0">Found in the wild</h2>
      </div>
      <p className="text-[var(--muted)] text-sm mb-6">Highest live AIO scores from our analyzer — real stores, re-runnable audits. None has the deterministic agent layer yet, so none can be certified Gold.</p>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" size={18} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter stores or platforms…"
          className="w-full glass-flat pl-10 pr-4 py-2.5 text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--violet)]" />
      </div>

      <div className="glass overflow-hidden">
        <table className="w-full text-left border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-white text-[13px]">
              <th className="py-3 px-4 font-semibold w-12">#</th>
              <th className="py-3 px-4 font-semibold">Store</th>
              <th className="py-3 px-4 font-semibold hidden sm:table-cell">Platform</th>
              <th className="py-3 px-4 font-semibold hidden md:table-cell">Passing</th>
              <th className="py-3 px-4 font-semibold text-right">AIO</th>
              <th className="py-3 px-4 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s, i) => {
              const tier = tierOf(s.score);
              return (
                <tr key={s.domain} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 px-4 text-[var(--faint)] font-mono">{i + 1}</td>
                  <td className="py-3 px-4">
                    <span className="text-white font-medium">{s.domain}</span>
                    {s.score >= 60 && <span className="ml-2 text-[11px] px-2 py-0.5 chip" style={{ color: tier.color }}>{tier.label}</span>}
                  </td>
                  <td className="py-3 px-4 text-[var(--muted)] hidden sm:table-cell">{s.platform}</td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    <span className="text-[12px] text-[var(--muted)]">{s.passed.map(p => CHECK_LABEL[p] || p).join(' · ')}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-display font-bold" style={{ color: tier.color === 'var(--faint)' ? 'var(--muted)' : tier.color }}>{s.score}</td>
                  <td className="py-3 px-4">
                    <a href={`/?audit=${encodeURIComponent(s.domain)}`} title="Re-run this audit live" className="text-[var(--cyan)]"><ExternalLink size={15} /></a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <p className="text-center text-[var(--faint)] mt-8">No stores match “{q}”.</p>}

      <p className="text-xs text-[var(--faint)] mt-4">Scores from live audits (July 2026) — click ↗ to re-run any of them right now. Methodology: robots 15 · schema 20 · llms.txt 15 · feed 15 · API 15 · agent layer 20.</p>
    </div>
  );
}
