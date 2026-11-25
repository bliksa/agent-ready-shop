/**
 * Agent Ready Shop — certificate + badge core.
 *
 * Isomorphic (no browser/node-only APIs) so the exact same logic runs in the
 * React frontend, the Express server, and — mirrored in PHP — inside the
 * WordPress plugin. The certificate ID is derived deterministically from the
 * store domain, so a badge link can be verified without a database.
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
  gold: { accent: '#b8860b', accentSoft: '#e9c766' },
  blue: { accent: '#10a37f', accentSoft: '#5fded0' },
  none: { accent: '#8c8f94', accentSoft: '#c3c4c7' },
};

export interface BadgeOpts {
  domain: string;
  score: number;
  style?: 'dark' | 'light';
}

/** Render the embeddable SVG badge (240x56). */
export function buildBadgeSvg({ domain, score, style = 'dark' }: BadgeOpts): string {
  const tier = getTier(score);
  const { accent, accentSoft } = COLORS[tier];
  const dark = style === 'dark';
  const bg = dark ? '#1d2327' : '#ffffff';
  const stroke = dark ? 'none' : '#dcdcde';
  const main = dark ? '#ffffff' : '#1d2327';
  const short = tierShort(tier);
  const dom = normalizeDomain(domain).slice(0, 26);

  return `<svg width="240" height="56" viewBox="0 0 240 56" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Agent Ready ${short}">
  <rect x="0.5" y="0.5" width="239" height="55" rx="7" fill="${bg}" stroke="${stroke}"/>
  <g transform="translate(16,14)">
    <rect width="28" height="28" rx="7" fill="${accent}"/>
    <rect x="7" y="9" width="14" height="11" rx="2.5" fill="#ffffff"/>
    <circle cx="11" cy="14.5" r="1.7" fill="${accent}"/>
    <circle cx="17" cy="14.5" r="1.7" fill="${accent}"/>
    <rect x="12.5" y="3.5" width="3" height="4" rx="1.5" fill="#ffffff"/>
  </g>
  <text x="54" y="24" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="${main}" letter-spacing="0.3">AGENT READY</text>
  <text x="54" y="39" font-family="Arial, Helvetica, sans-serif" font-size="9.5" font-weight="700" fill="${accent}" letter-spacing="0.6">${short}</text>
  <text x="54" y="50" font-family="Arial, Helvetica, sans-serif" font-size="8" fill="${dark ? '#8c8f94' : '#8c8f94'}">${dom}</text>
  <rect x="184" y="13" width="42" height="30" rx="5" fill="${accent}"/>
  <text x="205" y="30" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">${score}</text>
  <text x="205" y="39" font-family="Arial, Helvetica, sans-serif" font-size="6.5" fill="${accentSoft}" text-anchor="middle" letter-spacing="0.5">/ 100 AIO</text>
</svg>`;
}
