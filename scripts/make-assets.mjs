// Rasterize the WordPress.org plugin assets (icon + banner) from SVG to the
// required PNG sizes. Requires `sharp`.  Run: node scripts/make-assets.mjs
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';

const OUT = 'wporg-assets';
mkdirSync(OUT, { recursive: true });

const icon = readFileSync(`${OUT}/icon.svg`);
const banner = readFileSync(`${OUT}/banner.svg`);

const jobs = [
  [icon, 128, 128, 'icon-128x128.png'],
  [icon, 256, 256, 'icon-256x256.png'],
  [banner, 772, 250, 'banner-772x250.png'],
  [banner, 1544, 500, 'banner-1544x500.png'],
];

for (const [buf, w, h, name] of jobs) {
  await sharp(buf, { density: 300 }).resize(w, h).png().toFile(`${OUT}/${name}`);
  console.log(`✓ ${name} (${w}x${h})`);
}
console.log('\nWordPress.org assets ready in wporg-assets/. Add screenshot-1..5.png captured from a real store, then commit these to the plugin SVN /assets directory.');
