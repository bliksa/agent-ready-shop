// Build the plain-hosting version of the website: static frontend + PHP endpoints
// + the plugin zip, ready to upload (FTP) into any directory of a PHP host.
//   node scripts/build-static.mjs [folder-name]     → site/<folder-name>/ and site/<folder-name>.zip
//
// SITE_URL is the public address the folder will be served from (no trailing
// slash). It is stamped into the plugin zip (AFS_SERVICE_URL: badge, verify and
// update links) and into the page's canonical / social tags.
//   SITE_URL=https://shop.example/ashop node scripts/build-static.mjs
import JSZip from 'jszip';
import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'fs';
import { join, posix } from 'path';

const name = process.argv[2] || 'ashop';
const out = join('site', name);
const DEFAULT_SITE_URL = 'https://www.godot.sk/ashop';
const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');
if (!/^https:\/\/[a-z0-9.-]+(\/[A-Za-z0-9._~\/-]*)?$/.test(siteUrl)) {
  console.error(`SITE_URL must be an https:// URL without query or trailing slash, got: ${siteUrl}`);
  process.exit(1);
}
rmSync('site', { recursive: true, force: true });

// 1. Frontend with relative asset paths, talking to the PHP files next to it.
execSync(`npx vite build --base=./ --outDir ${out} --emptyOutDir`, { stdio: 'inherit', env: { ...process.env, VITE_STATIC: '1', VITE_SITE_URL: siteUrl } });

// 2. PHP endpoints (audit, badge, verify).
// Files only: a local test run of the PHP leaves its cache in static/data/, which is not part of the site.
for (const f of readdirSync('static', { withFileTypes: true })) if (f.isFile()) copyFileSync(join('static', f.name), join(out, f.name));

// 3. Plugin download — the public zip (no vendor license tools).
function addDir(zip, dir, base, skip = () => false, transform = (_rel, buf) => buf) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.DS_Store' || skip(e)) continue;
    const rel = posix.join(base, e.name);
    if (e.isDirectory()) addDir(zip, join(dir, e.name), rel, skip, transform);
    else zip.file(rel, transform(rel, readFileSync(join(dir, e.name))));
  }
}
// The plugin must talk to THIS deployment, wherever it is hosted.
let stamped = 0;
const stamp = (rel, buf) => {
  if (!/\.(php|txt)$/.test(rel)) return buf;
  const text = buf.toString('utf8');
  const next = text.split(DEFAULT_SITE_URL).join(siteUrl).split(DEFAULT_SITE_URL.replace('https://', '')).join(siteUrl.replace('https://', ''));
  if (rel.endsWith('/agent-ready-shop.php') && next.includes(`define( 'AFS_SERVICE_URL', '${siteUrl}' )`)) stamped++;
  return Buffer.from(next);
};
const plugin = new JSZip();
addDir(plugin, 'plugin/agent-ready-shop', 'agent-ready-shop', e => e.isDirectory() && e.name === 'tools', stamp);
if (stamped !== 1) { console.error('Could not stamp AFS_SERVICE_URL into the plugin.'); process.exit(1); }
writeFileSync(join(out, 'agent-ready-shop.zip'), await plugin.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

// 4. One archive of the whole folder for easy upload.
const site = new JSZip();
addDir(site, out, name);
writeFileSync(join('site', `${name}.zip`), await site.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

console.log(`\n✓ ${out}/  — upload this folder so it is served at ${siteUrl}/`);
console.log(`✓ the bundled plugin points at ${siteUrl}`);
console.log(`✓ site/${name}.zip — the same folder as one archive`);
