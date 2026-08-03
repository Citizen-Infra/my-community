// Regenerate the self-hosted fonts (#93). Run: node scripts/fetch-fonts.mjs
//
// The dashboard used to load DM Sans and Instrument Serif from
// fonts.googleapis.com on every new tab, handing Google an IP address and a
// User-Agent on the most frequent action in the product. The families are
// OFL-licensed, so they ship with the extension instead.
//
// This asks Google Fonts for the same CSS the page used to link, then downloads
// the woff2 files it points at and rewrites the @font-face rules to local
// paths. Doing it this way rather than by hand keeps the subsets and
// unicode-ranges exactly as Google computed them — those ranges are what stop a
// Cyrillic page pulling a Latin font file, and hand-writing them goes stale.
//
// Only the latin and latin-ext subsets are kept. The rest of the UI is English,
// and latin-ext covers the accented characters European member names need.

import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// A browser User-Agent is required: Google serves woff2 only to clients it
// believes support it, and returns older formats otherwise.
const CSS_URL = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@'
  + '0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400'
  + '&family=Instrument+Serif:ital@0;1&display=swap';

const OFL = {
  dmsans: 'DM Sans',
  instrumentserif: 'Instrument Serif',
};

async function get(url, binary = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
}

const css = await get(CSS_URL);
const blocks = [...css.matchAll(/@font-face\s*\{(.*?)\}/gs)].map((m) => m[1]);
if (!blocks.length) throw new Error('no @font-face rules returned — the CSS API shape changed');

const faces = [];
const files = new Map();

for (const b of blocks) {
  const family = /font-family:\s*'([^']+)'/.exec(b)?.[1];
  const style = /font-style:\s*(\w+)/.exec(b)?.[1];
  const weight = /font-weight:\s*([\d ]+)/.exec(b)?.[1]?.trim();
  const src = /url\((https:\/\/[^)]+)\)/.exec(b)?.[1];
  const range = /unicode-range:\s*([^;]+);/.exec(b)?.[1]?.trim();
  if (!family || !style || !weight || !src || !range) continue;

  // Identify the subset by a character only that subset covers.
  const subset = range.includes('U+0000-00FF') ? 'latin'
    : range.includes('U+0100-02BA') ? 'latin-ext'
      : null;
  if (!subset) continue;

  const name = `${family.toLowerCase().replace(/ /g, '-')}-${subset}`
    + `${style === 'italic' ? '-italic' : ''}.woff2`;
  files.set(name, src);
  faces.push({ family, style, weight, name, range });
}

mkdirSync(join(root, 'public/fonts'), { recursive: true });

for (const [name, src] of files) {
  writeFileSync(join(root, 'public/fonts', name), await get(src, true));
  console.log(`  ${name.padEnd(40)} ${statSync(join(root, 'public/fonts', name)).size} bytes`);
}

const out = [
  '/* Self-hosted (#93). GENERATED — edit scripts/fetch-fonts.mjs, not this file.',
  '   Same families, subsets and unicode-ranges as the Google CSS it replaced,',
  '   served from disk. DM Sans is variable, so one file covers 400-700 and',
  '   several weights share a src. Regenerate: node scripts/fetch-fonts.mjs */',
  '',
];
for (const f of faces) {
  out.push('@font-face {',
    `  font-family: '${f.family}';`,
    `  font-style: ${f.style};`,
    `  font-weight: ${f.weight};`,
    '  font-display: swap;',
    `  src: url('./fonts/${f.name}') format('woff2');`,
    `  unicode-range: ${f.range};`,
    '}', '');
}
writeFileSync(join(root, 'public/fonts.css'), out.join('\n'));

for (const [slug, label] of Object.entries(OFL)) {
  const txt = await get(`https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/OFL.txt`);
  writeFileSync(join(root, 'public/fonts', `OFL-${slug}.txt`), txt);
  console.log(`  OFL-${slug}.txt (${label})`);
}

console.log(`\n${files.size} files, ${faces.length} @font-face rules -> public/fonts.css`);
