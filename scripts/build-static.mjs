// Build the plain-hosting version of the website: static frontend + PHP endpoints
// + the plugin zip, ready to upload (FTP) into any directory of a PHP host.
//   node scripts/build-static.mjs [folder-name]     → site/<folder-name>/ and site/<folder-name>.zip
import JSZip from 'jszip';
import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'fs';
import { join, posix } from 'path';

const name = process.argv[2] || 'ashop';
const out = join('site', name);
rmSync('site', { recursive: true, force: true });

// 1. Frontend with relative asset paths, talking to the PHP files next to it.
execSync(`npx vite build --base=./ --outDir ${out} --emptyOutDir`, { stdio: 'inherit', env: { ...process.env, VITE_STATIC: '1' } });

// 2. PHP endpoints (audit, badge, verify).
for (const f of readdirSync('static')) copyFileSync(join('static', f), join(out, f));

// 3. Plugin download — the public zip (no vendor license tools).
function addDir(zip, dir, base, skip = () => false) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.DS_Store' || skip(e)) continue;
    if (e.isDirectory()) addDir(zip, join(dir, e.name), posix.join(base, e.name), skip);
    else zip.file(posix.join(base, e.name), readFileSync(join(dir, e.name)));
  }
}
const plugin = new JSZip();
addDir(plugin, 'plugin/agent-ready-shop', 'agent-ready-shop', e => e.isDirectory() && e.name === 'tools');
writeFileSync(join(out, 'agent-ready-shop.zip'), await plugin.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

// 4. One archive of the whole folder for easy upload.
const site = new JSZip();
addDir(site, out, name);
writeFileSync(join('site', `${name}.zip`), await site.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

console.log(`\n✓ ${out}/  — upload this folder to your web root (→ https://your-domain/${name}/)`);
console.log(`✓ site/${name}.zip — the same folder as one archive`);
