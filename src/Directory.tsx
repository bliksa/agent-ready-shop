import React, { useMemo, useState } from 'react';
import { withBase } from './utils/base';
import { useT } from './i18n';
import { checkCopy } from './data/auditConfig';
import { CheckId } from './types';
import { SectionHead } from './ui';

interface WildStore {
  domain: string;
  score: number;
  platform: string;
  passed: CheckId[];
}

// Results recorded by the batch analyzer (scripts/audit-batch.mjs, July 2026).
// A snapshot: the rubric has been refined since, so every row links to a live re-run.
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

export function Directory({ onBack }: { onBack: () => void }) {
  const { t, lang } = useT();
  const d = t.dir;
  const [q, setQ] = useState('');
  const list = useMemo(() => WILD.filter(s => (s.domain + s.platform).toLowerCase().includes(q.toLowerCase())), [q]);

  return (
    <div className="view">
      <button type="button" onClick={onBack} className="link mt-8">← {t.common.back}</button>

      {/* Certified registry — honest empty state */}
      <section className="pt-10 md:pt-14">
        <span className="tag tag-clay">{d.tag}</span>
        <h1 className="display display-xl mt-6 mb-6 max-w-[1000px]">{d.title}</h1>
        <p className="lead max-w-[640px] mb-7" style={{ color: 'var(--ink2)' }}>{d.sub}</p>
        <a href={withBase('/api/download-plugin')} className="btn btn-primary">{d.cta}</a>
      </section>

      {/* Wild leaderboard — recorded audit data */}
      <section className="sec">
        <SectionHead title={d.wildTitle} />
        <p className="body max-w-[720px] mb-7">{d.wildSub}</p>

        <input value={q} onChange={e => setQ(e.target.value)} placeholder={d.filter} aria-label={d.filter} className="field field-sm max-w-[420px] mb-6" />

        <div className="panel overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-12">#</th>
                <th>{d.store}</th>
                <th className="hidden sm:table-cell">{d.platform}</th>
                <th className="hidden md:table-cell">{d.passing}</th>
                <th className="text-right">Score</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.domain}>
                  <td className="font-mono text-[12px]" style={{ color: 'var(--ink3)' }}>{String(i + 1).padStart(2, '0')}</td>
                  <td>
                    <span className="text-ink font-bold mr-3">{s.domain}</span>
                    {s.score >= 60 && <span className={`tag ${s.score >= 85 ? 'tag-solid' : 'tag-clay'}`}>{s.score >= 85 ? d.gold : d.verified}</span>}
                  </td>
                  <td className="hidden sm:table-cell">{s.platform}</td>
                  <td className="hidden md:table-cell font-mono text-[11.5px]">{s.passed.map(p => checkCopy(lang, p).short).join(' · ')}</td>
                  <td className="text-right"><span className="num text-[26px]" style={s.score >= 60 ? undefined : { color: 'var(--ink2)' }}>{s.score}</span></td>
                  <td>
                    <a href={withBase('/') + '?audit=' + encodeURIComponent(s.domain)} title={d.rerun} aria-label={`${d.rerun}: ${s.domain}`} className="font-mono text-ink2 hover:text-ink no-underline">↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <p className="small mt-8">{d.noMatch(q)}</p>}

      </section>
    </div>
  );
}
