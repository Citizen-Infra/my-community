// One-off test (no framework in this repo). Run: node scripts/favicon.test.mjs
//
// Guards #92: site icons must come from Chrome's local cache, never from a
// third party. This regressed once by being the obvious way to get an icon, and
// the symptom is invisible — icons still appear, they just cost every saved
// hostname a round trip to Google.

globalThis.chrome = {
  runtime: { getURL: (p) => `chrome-extension://mcextensionid${p}` },
};

const { getFaviconUrl, getDomain } = await import('../src/lib/favicon.js');

let failures = 0;
const assert = (cond, msg) => {
  if (cond) console.log('ok:', msg);
  else { console.error('FAIL:', msg); failures++; }
};

const url = getFaviconUrl('https://example.com/some/page?q=1');

assert(!/google\.com/i.test(url), 'no request to google.com');
assert(url.startsWith('chrome-extension://'), 'served by the extension itself');
assert(url.includes('/_favicon/'), "uses Chrome's local favicon cache");

// The full page URL is what _favicon wants, not a bare hostname.
const parsed = new URL(url);
assert(
  parsed.searchParams.get('pageUrl') === 'https://example.com/some/page?q=1',
  'passes the whole page URL, not just the hostname',
);
assert(parsed.searchParams.get('size') === '32', 'requests a 32px icon');

// An unparseable URL should yield nothing rather than a broken icon.
assert(getFaviconUrl('not a url') === '', 'garbage input yields no icon');
assert(getFaviconUrl(undefined) === '', 'undefined yields no icon');

// getDomain is unrelated to the leak but shares the module.
assert(getDomain('https://www.example.com/x') === 'example.com', 'getDomain strips www.');
assert(getDomain('nonsense') === 'nonsense', 'getDomain passes through unparseable input');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
