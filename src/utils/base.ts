/**
 * Where the app's backend lives.
 *
 * - Node server (default): root-relative routes under an optional base path
 *   ('' at the domain root, '/ashop' in a subdirectory — BASE_PATH at build time).
 * - Static build (`npm run build:static`, VITE_STATIC=1): plain PHP files that
 *   sit next to index.html, addressed relatively so the folder works in any
 *   directory of an ordinary PHP host with no URL rewrites.
 */
const env = (import.meta as any).env || {};

export const STATIC: boolean = env.VITE_STATIC === '1';
export const BASE: string = (env.BASE_URL || '/').replace(/\/+$/, '').replace(/^\.$/, '');

function staticPath(p: string): string {
  let m: RegExpMatchArray | null;
  if (p === '/') return './';
  if (p.startsWith('/api/download-plugin')) return 'agent-ready-shop.zip';
  if ((m = p.match(/^\/api\/badge(\?.*)?$/))) return 'badge.php' + (m[1] || '');
  if ((m = p.match(/^\/verify\/([^?]*)(?:\?(.*))?$/))) return `verify.php?id=${m[1]}${m[2] ? '&' + m[2] : ''}`;
  if ((m = p.match(/^\/api\/([^?]+)(?:\?(.*))?$/))) return `api.php?action=${m[1]}${m[2] ? '&' + m[2] : ''}`;
  return '.' + p;
}

/** URL for a server route ('/api/…', '/verify/…'), usable in fetch() and href. */
export const withBase = (p: string): string => (STATIC ? staticPath(p) : BASE + p);

/** Absolute URL for a server route — for links that get embedded on other sites. */
export function absUrl(p: string): string {
  if (typeof window === 'undefined') return 'https://agentreadyshop.com' + p;
  return STATIC ? new URL(staticPath(p), window.location.href.split(/[?#]/)[0]).href : window.location.origin + BASE + p;
}
