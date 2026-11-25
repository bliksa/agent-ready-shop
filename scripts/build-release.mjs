// Build the WordPress.org distribution: a clean plugin zip (no vendor tools,
// no dev files) plus the rasterized wp.org assets.  Run: node scripts/build-release.mjs
import JSZip from 'jszip';
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join, posix } from 'path';

const SRC = 'plugin/agent-ready-shop';
const OUT = 'release';
// Excluded from the public plugin zip.
const EXCLUDE_DIRS = new Set(['tools']);           // vendor CLI (needs the private key)
const EXCLUDE_FILES = new Set(['.DS_Store']);

const version = (readFileSync(join(SRC, 'agent-ready-shop.php'), 'utf8').match(/Version:\s*([0-9.]+)/) || [])[1] || '0.0.0';

const zip = new JSZip();
let count = 0;
function walk(dir, base) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), posix.join(base, e.name));
    } else {
      if (EXCLUDE_FILES.has(e.name)) continue;
      zip.file(posix.join(base, e.name), readFileSync(join(dir, e.name)));
      count++;
    }
  }
}
walk(SRC, 'agent-ready-shop');

mkdirSync(OUT, { recursive: true });
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
const zipName = `agent-ready-shop.${version}.zip`;
writeFileSync(join(OUT, zipName), buf);

// Copy wp.org assets if built.
const assets = ['icon-128x128.png', 'icon-256x256.png', 'banner-772x250.png', 'banner-1544x500.png'];
mkdirSync(join(OUT, 'assets'), { recursive: true });
let copied = 0;
for (const a of assets) {
  const p = join('wporg-assets', a);
  if (existsSync(p)) { copyFileSync(p, join(OUT, 'assets', a)); copied++; }
}

console.log(`✓ ${OUT}/${zipName}  (${count} files, ${(buf.length / 1024).toFixed(0)} KB, version ${version})`);
console.log(`✓ ${OUT}/assets/  (${copied}/${assets.length} wp.org assets; run make-assets.mjs first if 0)`);
console.log('  Excluded from the zip: tools/ (vendor license CLI).');
console.log('  Remember: add screenshot-1..5.png to the SVN /assets, not the zip.');
