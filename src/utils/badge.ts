/**
 * Agent Ready Shop — certificate + badge core.
 *
 * Isomorphic (no browser/node-only APIs) so the exact same logic runs in the
 * React frontend, the Express server, and — mirrored in PHP — inside the
 * static PHP build (static/lib.php). The certificate ID is a reference label
 * derived from the domain with a public constant: it is NOT a secret and
 * proves nothing by itself. A certificate is valid only when the service's own
 * live audit says so.
 */

export type Tier = 'gold' | 'blue' | 'none';

export interface CertInfo {
  domain: string;
  score: number;
  tier: Tier;
  tierLabel: string;
  tierShort: string;
  certId: string;
  issued: string;      // YYYY-MM-DD
  validUntil: string;  // YYYY-MM-DD
}

const SECRET = 'agent-ready-shop:v1';

/** djb2 (multiply variant), reduced mod 2^32 — identical in JS and PHP. */
function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33 + str.charCodeAt(i)) % 4294967296;
  }
  return h >>> 0;
}

function b36(n: number): string {
  return n.toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

export function normalizeDomain(input: string): string {
  return (input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

export function getTier(score: number): Tier {
  if (score >= 85) return 'gold';
  if (score >= 60) return 'blue';
  return 'none';
}

export function tierLabel(t: Tier): string {
  return t === 'gold' ? 'Certified · Agent-Transacting'
    : t === 'blue' ? 'Verified · Agent-Readable'
    : 'Not yet certified';
}

export function tierShort(t: Tier): string {
  return t === 'gold' ? 'CERTIFIED' : t === 'blue' ? 'VERIFIED' : 'NOT READY';
}

export function makeCertId(domain: string): string {
  const d = normalizeDomain(domain);
  return 'ARS-' + b36(djb2(d)) + '-' + b36(djb2(SECRET + d));
}

function addYear(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return [y + 1, String(m).padStart(2, '0'), String(d).padStart(2, '0')].join('-');
}

export function buildCert(domain: string, score: number, issuedISO?: string): CertInfo {
  const d = normalizeDomain(domain);
  const issued = issuedISO || new Date().toISOString().slice(0, 10);
  const tier = getTier(score);
  return {
    domain: d,
    score,
    tier,
    tierLabel: tierLabel(tier),
    tierShort: tierShort(tier),
    certId: makeCertId(d),
    issued,
    validUntil: addYear(issued),
  };
}

/** Confirm a certificate ID matches a domain (tamper check for /verify). */
export function verifyCertId(domain: string, certId: string): boolean {
  return makeCertId(domain) === (certId || '').toUpperCase().trim();
}

const COLORS: Record<Tier, { accent: string; accentSoft: string }> = {
  gold: { accent: '#d97757', accentSoft: '#3a1d12' },
  blue: { accent: '#b9a37e', accentSoft: '#2f2718' },
  none: { accent: '#6f747b', accentSoft: '#d6d8db' },
};

export interface BadgeOpts {
  domain: string;
  /** Live score, or null when the store was never audited. */
  score: number | null;
  style?: 'dark' | 'light';
  /** Whether the last live audit certified the store (default true, for previews). */
  certified?: boolean;
}

/** Render the embeddable SVG badge (240x56). Keep in sync with ars_badge_svg() in static/lib.php. */
export function buildBadgeSvg({ domain, score, style = 'dark', certified = true }: BadgeOpts): string {
  const tier: Tier = certified && score !== null ? getTier(score) : 'none';
  const { accent, accentSoft } = COLORS[tier];
  const dark = style === 'dark';
  const bg = dark ? '#000000' : '#f7f4ee';
  const stroke = dark ? '#33363b' : '#c9c5bb';
  const main = dark ? '#f7f4ee' : '#000000';
  const sub = dark ? '#6f747b' : '#5c6066';
  const onAccent = tier === 'none' ? '#ffffff' : '#000000';
  const short = tier === 'none' ? 'NOT VERIFIED' : tierShort(tier);
  const dom = normalizeDomain(domain).slice(0, 24).replace(/[^a-z0-9.\-]/g, '');
  const num = score === null ? '–' : String(Math.round(score));
  const mono = "'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace";
  const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

  return `<svg width="240" height="56" viewBox="0 0 240 56" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Agent Ready ${short}">
  <rect x="0.5" y="0.5" width="239" height="55" fill="${bg}" stroke="${stroke}"/>
  <text x="12" y="35" font-family="${sans}" font-size="22" font-weight="700" fill="${main}">A<tspan fill="${accent}">/</tspan></text>
  <text x="46" y="25" font-family="${sans}" font-size="12.5" font-weight="700" fill="${main}" letter-spacing="1.4">AGENT READY</text>
  <text x="46" y="38" font-family="${mono}" font-size="8.5" font-weight="500" fill="${accent}" letter-spacing="1.2">${short}</text>
  <text x="46" y="49" font-family="${mono}" font-size="7.5" fill="${sub}">${dom}</text>
  <rect x="184" y="13" width="42" height="30" fill="${accent}"/>
  <text x="205" y="31" font-family="${sans}" font-size="16" font-weight="700" fill="${onAccent}" text-anchor="middle">${num}</text>
  <text x="205" y="39.5" font-family="${mono}" font-size="5.5" fill="${tier === 'none' ? accentSoft : onAccent}" text-anchor="middle" letter-spacing="0.6">/ 100 AIO</text>
</svg>`;
}
