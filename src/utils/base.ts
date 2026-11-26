/**
 * Base path the app is served under ('' at the domain root, '/ashop' when
 * hosted in a subdirectory). Set at build time via BASE_PATH (see vite.config.ts).
 */
export const BASE: string = ((import.meta as any).env?.BASE_URL || '/').replace(/\/+$/, '');

/** Prefix a root-relative path ('/api/…') with the base path. */
export const withBase = (p: string): string => BASE + p;
