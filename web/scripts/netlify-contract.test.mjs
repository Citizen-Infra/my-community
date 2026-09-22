import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const redirects = readFileSync(resolve(root, 'public/_redirects'), 'utf8');
const headers = readFileSync(resolve(root, 'public/_headers'), 'utf8');
const config = readFileSync(resolve(root, '../netlify.toml'), 'utf8');
const vite = readFileSync(resolve(root, 'vite.config.js'), 'utf8');

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

assert(redirects.trim() === '/* /index.html 200', 'Netlify serves client routes through the app shell');
assert(headers.includes('X-Content-Type-Options: nosniff'), 'Netlify preserves the server security headers');
assert(headers.includes('/assets/*') && headers.includes('immutable'), 'fingerprinted assets keep immutable caching');
assert(config.includes('base = "web"') && config.includes('publish = "dist"'), 'Netlify builds and publishes the web workspace');
assert(vite.includes("dist/oauth") && vite.includes('VITE_BLUESKY_ENABLED'), 'Bluesky-off builds remove OAuth client metadata');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
