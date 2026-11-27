import React, { ReactNode, useId } from 'react';

/** Section header: condensed title, optional clay number and right-aligned mono note. */
export function SectionHead({ num, title, meta, as: Tag = 'h2' }: { num?: string; title: ReactNode; meta?: ReactNode; as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <div className="sec-head">
      {num && <span className="sec-num" aria-hidden="true">{num}</span>}
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

/**
 * The mark: a capital A whose left leg is cut free from the rest of the letter
 * by a gap. Sized by the surrounding font (cap height). public/favicon.svg is
 * the same letter on a black square, with the leg in clay.
 */
export function Mark({ className = '' }: { className?: string }) {
  const id = useId();
  const leg = 'M3 27 11.5 5H16L7.5 27z';
  return (
    <svg className={`mark ${className}`} viewBox="3 5 26 22" role="img" aria-label="A" fill="currentColor">
      <mask id={id}>
        <rect x="0" y="0" width="32" height="32" fill="#fff" />
        <path d={leg} fill="#000" stroke="#000" strokeWidth="3.2" />
      </mask>
      <g mask={`url(#${id})`}>
        <path d="M16 5h4.5L29 27h-4.5z" />
        <path d="M9 17.4h13.5v4.1H9z" />
      </g>
      <path d={leg} />
    </svg>
  );
}

/** The clay slash of A/SHOP, drawn at the weight of the bold wordmark (a typed "/" is too thin). */
export function Slash() {
  return (
    <svg className="slash" viewBox="0 0 15 26" aria-hidden="true">
      <path d="M0 26 10 0h5L5 26z" fill="var(--clay)" />
    </svg>
  );
}
