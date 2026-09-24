import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDeploymentConfig } from '../../extension/src/lib/deployment-config.js';
import { transformDeploymentHtml } from '../deployment-branding.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceHtml = readFileSync(join(root, 'index.html'), 'utf8');

assert.equal(
  transformDeploymentHtml(sourceHtml, createDeploymentConfig()),
  sourceHtml,
  'ordinary deployments retain the original document shell',
);

const pxxi = createDeploymentConfig({ VITE_PINNED_COMMUNITY_ID: 'philanthropic-xxi' });
const brandedHtml = transformDeploymentHtml(sourceHtml, pxxi);
for (const expected of [
  'data-deployment-brand="philanthropic-xxi"',
  '<title>Philanthropic XXI</title>',
  '/manifest-philanthropic-xxi.webmanifest',
  '/icons/philanthropic-xxi.svg',
  '/pxxi-fonts.css',
  'content="#E4E7E0"',
]) {
  assert.ok(brandedHtml.includes(expected), `PXXI shell includes ${expected}`);
}
assert.ok(!brandedHtml.includes('<title>My Community</title>'), 'PXXI shell removes the default document title');

assert.throws(
  () => transformDeploymentHtml(sourceHtml.replace('<title>My Community</title>', '<title>Changed</title>'), pxxi),
  /could not find expected markup/,
  'branding fails closed when the document shell drifts',
);

const manifest = JSON.parse(readFileSync(join(root, 'public', 'manifest-philanthropic-xxi.webmanifest'), 'utf8'));
assert.equal(manifest.name, 'Philanthropic XXI', 'install metadata uses the PXXI name');
assert.equal(manifest.icons[0].src, '/icons/philanthropic-xxi.svg', 'install metadata uses the confidence mark');

const brandCss = readFileSync(join(root, 'src', 'pxxi-brand.css'), 'utf8');
assert.ok(brandCss.includes('html[data-deployment-brand="philanthropic-xxi"]'), 'PXXI tokens are deployment-scoped');
assert.ok(brandCss.includes('[data-theme="dark"]'), 'PXXI has an explicit dark companion');
assert.ok(brandCss.includes('.live-strip--inset:hover'), 'PXXI removes the shared live-strip hover lift');
assert.ok(brandCss.includes('.decision-objection-submit:hover:not(:disabled)'), 'PXXI removes the shared amber action shadow');
assert.ok(brandCss.includes('.preference-dialog-backdrop'), 'PXXI removes shared overlay blur');
assert.ok(brandCss.includes('.account-doors {'), 'PXXI stacks Telegram and linked email instead of forcing narrow columns');

const settings = readFileSync(join(root, 'src', 'WebSettings.jsx'), 'utf8');
assert.ok(settings.indexOf('class="telegram-door"') < settings.indexOf('<form onSubmit={emailSignIn}>'), 'PXXI offers Telegram before linked email');
assert.ok(settings.includes('!telegramCommunity && deploymentConfig.blueskyEnabled'), 'PXXI settings omit the Bluesky sign-in door');

const connect = readFileSync(join(root, '..', 'extension', 'src', 'components', 'CommunityInputConnect.jsx'), 'utf8');
assert.ok(connect.includes("deploymentConfig.pinnedCommunityId === 'philanthropic-xxi'"), 'PXXI Community Input has its own sign-in prompt');
assert.ok(connect.includes('onOpenSettings') && connect.includes('href="/settings"'), 'PXXI Community Input reaches Telegram-first account settings');

const overview = readFileSync(join(root, '..', 'extension', 'src', 'components', 'DashboardOverview.jsx'), 'utf8');
assert.ok(overview.indexOf('class="dashboard-landscape-link"') < overview.indexOf('class="dashboard-tile-grid"'), 'PXXI landscape is findable above the feed mosaic');

const webCss = readFileSync(join(root, 'src', 'web.css'), 'utf8');
assert.ok(webCss.includes('.web-wordmark span { min-width: 0; overflow: hidden;'), 'PXXI wordmark can shrink on phones without scrolling sideways');
assert.ok(webCss.includes('.web-sync-status { width: 36px; min-width: 36px;'), 'PXXI mobile status stops crowding the top bar');

const fontCss = readFileSync(join(root, 'public', 'pxxi-fonts.css'), 'utf8');
const fontPaths = [...fontCss.matchAll(/url\('\.\/fonts\/([^']+)'\)/g)].map((match) => match[1]);
assert.equal(fontPaths.length, 8, 'the PXXI type system declares every intended local subset');
for (const fontPath of fontPaths) {
  const absolutePath = join(root, 'public', 'fonts', fontPath);
  assert.ok(existsSync(absolutePath), `${fontPath} exists`);
  assert.equal(readFileSync(absolutePath).subarray(0, 4).toString('ascii'), 'wOF2', `${fontPath} is a WOFF2 file`);
}

console.log('PXXI branding tests passed');
