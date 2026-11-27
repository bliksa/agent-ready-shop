import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { LOGO } from './logo';

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

/** The A/SHOP logo (see logo.ts). Sized by its height; the letters take the current text colour. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg className={`logo ${className}`} viewBox={`0 ${-LOGO.over} ${LOGO.width} ${100 + LOGO.over}`} role="img" aria-label="A/SHOP">
      {LOGO.a.map(d => <path key={d} d={d} fill="currentColor" />)}
      {LOGO.check.map(d => <path key={d} d={d} fill="var(--clay)" />)}
      <path d={LOGO.word} fill="currentColor" />
    </svg>
  );
}

/**
 * Reveal on scroll: `shown` turns true once, when the element first enters the
 * viewport. Pair it with the `.reveal` / `.is-in` classes in index.css.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}
