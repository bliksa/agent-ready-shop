// Rasterise public/favicon.svg into the PNG icons browsers without SVG favicon support need
// (Safari, iOS home screen).  Run after the logo changes: node scripts/make-favicons.mjs
// Then raise the ?v= number on the icon links in index.html: the host caches these files for a
// year, so a browser only fetches a changed icon from a new address.
import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('public/favicon.svg');
for (const [name, size] of [['favicon-32.png', 32], ['favicon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  await sharp(svg, { density: 600 }).resize(size, size).png().toFile(`public/${name}`);
  console.log(`✓ public/${name}`);
}
