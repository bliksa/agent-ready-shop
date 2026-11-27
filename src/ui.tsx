import React, { ReactNode } from 'react';

/** Numbered section header: clay mono number, condensed title, right-aligned mono note. */
export function SectionHead({ num, title, meta, as: Tag = 'h2' }: { num: string; title: ReactNode; meta?: ReactNode; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <div className="sec-head">
      <span className="sec-num" aria-hidden="true">{num}</span>
      <Tag className="display display-lg">{title}</Tag>
      {meta && <div className="sec-meta label">{meta}</div>}
    </div>
  );
}

/** Segmented meter made of short dashes; `on` of `total` are lit. */
export function Dashes({ total, on, running, className = '' }: { total: number; on: number; running?: number; className?: string }) {
  return (
    <span className={`dashes ${className}`} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <i key={i} className={i === running ? 'run' : i < on ? 'on' : undefined} />)}
    </span>
  );
}

/** Machine-vision style label: `name 0.92`. */
export function DetectLabel({ name, value }: { name: string; value?: string }) {
  return <span className="detect-label">{name}{value !== undefined && <> <b>{value}</b></>}</span>;
}

/** Share of the maximum as a 0–1 confidence-style figure. */
export const ratio = (score: number, max: number): string => (max > 0 ? score / max : 0).toFixed(2);
