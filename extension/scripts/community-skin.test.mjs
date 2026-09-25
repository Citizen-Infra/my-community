// Community skins (#18) against community-admin#153's contract.
//
// Covers: the vendored interpreter is byte-for-byte community-admin's, the
// stylesheet is a closed variable set, and the controller's discovery,
// preview, explicit apply, update, restore, caching, sync, authorization-loss
// and every fallback path. Runs under plain node like the rest of scripts/.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const skinModule = await import('../src/lib/community-skin.js');
const {
  DEFAULT_SKIN,
  SKIN_CSS_VARIABLES,
  skinCssVariables,
} = skinModule;
const {
  SKIN_REVISIONS_KEY,
  SKIN_SELECTION_KEY,
  SKIN_STYLE_ID,
  applySkinToDocument,
  clearPrivateSkinRevisions,
  createSkinController,
  normalizeSkinRef,
  previewVariables,
  revisionCacheKey,
  skinStylesheet,
} = await import('../src/lib/skin-runtime.js');
const { normalizeDashboardPreferences } = await import('../src/lib/dashboard-preferences.js');
const { createDeploymentConfig, deploymentSyncPreferences } = await import('../src/lib/deployment-config.js');
const { clearPrivateCommunityCaches } = await import('../src/lib/private-data.js');

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

// ---------------------------------------------------------------------------
// The interpreter is community-admin's module, unchanged.
//
// community-admin's panel preview renders through shared/community-skin.js at
// Citizen-Infra/community-admin@2f26f81 (#165). Equivalent token output is
// guaranteed by running the identical file; this hash is what makes an edit
// here fail loudly. To take a new version, copy the file verbatim and update
// the hash and commit together.
const CA_SKIN_MODULE_SHA256 = '738a75b9197567fa2dcac1acf717729412baadb089d1b545cb704cbc769950c8';
const vendored = readFileSync(new URL('../src/lib/community-skin.js', import.meta.url));
assert(createHash('sha256').update(vendored).digest('hex') === CA_SKIN_MODULE_SHA256,
  'lib/community-skin.js is byte-identical to community-admin shared/community-skin.js');

// Golden token output for a fixed skin, the fixture both sides can compare.
const HARBOUR = {
  schemaVersion: 1,
  name: 'Harbour',
  light: {
    page: '#f4f7f8', surface: '#ffffff', surfaceHover: '#e9eff1',
    primary: '#1f5a7a', primaryHover: '#153f56', onPrimary: '#ffffff',
    accent: '#b45309', accentHover: '#8a3f07', onAccent: '#ffffff',
    text: '#14202a', textSecondary: '#3e4c57', textMuted: '#5a6873',
    border: '#cfd9de', borderLight: '#e3eaee',
  },
  dark: {
    page: '#0f1519', surface: '#172027', surfaceHover: '#1f2b33',
    primary: '#7cc3e8', primaryHover: '#a5d7f1', onPrimary: '#0b1318',
    accent: '#fbbf24', accentHover: '#fcd34d', onAccent: '#1c1917',
    text: '#e8eef1', textSecondary: '#b3c1ca', textMuted: '#93a3ad',
    border: '#33424c', borderLight: '#24313a',
  },
  typography: 'sans',
  shape: 'square',
};
const lightVars = skinCssVariables(HARBOUR, 'light');
assert(lightVars['--color-bg'] === '#f4f7f8' && lightVars['--color-surface-raised'] === '#ffffff',
  'palette roles map onto My Community variables');
assert(lightVars['--radius-md'] === '4px' && lightVars['--font-display'].startsWith("'DM Sans'"),
  'shape and typography presets map onto fixed values');

// ---------------------------------------------------------------------------
// Stylesheet: closed variable set, whole or nothing

const css = skinStylesheet(HARBOUR);
const declared = [...css.matchAll(/(--[a-z-]+):/g)].map((m) => m[1]);
assert(declared.length === SKIN_CSS_VARIABLES.length * 2, 'both modes declare the complete variable set');
assert(declared.every((name) => SKIN_CSS_VARIABLES.includes(name)), 'no variable outside the shared list reaches the page');
assert(!/url\(|@import|expression|<|>|\\/i.test(css), 'no URL, import, markup or escape reaches the page');
assert(css.includes(':root[data-mc-skin][data-theme="dark"]{--color-bg:#0f1519;'), 'dark mode reads the dark palette');
assert(!css.includes('--color-danger') && !css.includes('--color-session') && !css.includes('--space-'),
  'status, danger and spacing stay product-controlled');

const rejects = (doc, label) => {
  let threw = false;
  try { skinStylesheet(doc); } catch { threw = true; }
  assert(threw && previewVariables(doc, 'light') === null, `rejected: ${label}`);
};
rejects({ ...HARBOUR, light: { ...HARBOUR.light, page: 'url(https://evil.example/x.png)' } }, 'url() colour');
rejects({ ...HARBOUR, light: { ...HARBOUR.light, primary: 'red;} body{display:none' } }, 'declaration injection');
rejects({ ...HARBOUR, light: { ...HARBOUR.light, '--color-danger': '#000000' } }, 'custom-property name');
rejects({ ...HARBOUR, typography: "'Comic Sans MS'" }, 'font name outside the enum');
rejects({ ...HARBOUR, extra: '<script>' }, 'unknown key');
rejects({ ...HARBOUR, schemaVersion: 2 }, 'unknown schema version');
rejects({ ...HARBOUR, dark: { ...HARBOUR.dark, text: undefined } }, 'missing role');
rejects({ ...HARBOUR, light: { ...HARBOUR.light, text: '#e0e0e0' } }, 'failed contrast');
rejects({ ...HARBOUR, light: { ...HARBOUR.light, primary: '#f0f0f0' } }, 'invisible focus ring');

// ---------------------------------------------------------------------------
// Fakes

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map,
  };
}

function fakeDocument() {
  const nodes = new Map();
  const doc = {
    documentElement: { dataset: {} },
    head: { appendChild: (node) => { nodes.set(node.id, node); node.remove = () => nodes.delete(node.id); } },
    getElementById: (id) => nodes.get(id) || null,
    createElement: () => ({ id: '', textContent: '' }),
    nodes,
  };
  return doc;
}

const SKIN_A = 'sk_aaaaaaaaaaaaaaaaaaaaaaaa';
const SKIN_B = 'sk_bbbbbbbbbbbbbbbbbbbbbbbb';

// A tiny community-admin: communities -> { visibility, members, skin, revisions }.
function fakeServer() {
  const server = {
    requests: [],
    down: false,
    communities: {
      harbour: { name: 'Harbour Collective', visibility: 'public', skinId: SKIN_A, official: 1, revisions: { 1: { doc: HARBOUR } } },
      cellar: { name: 'Cellar', visibility: 'private', skinId: SKIN_B, official: 1, revisions: { 1: { doc: { ...HARBOUR, name: 'Cellar' } } }, members: true },
    },
  };
  server.fetch = async (url, init = {}) => {
    server.requests.push(url);
    if (server.down) throw new TypeError('Failed to fetch');
    const u = new URL(url);
    const authed = !!init.headers?.Authorization;
    const readable = (id) => {
      const c = server.communities[id];
      if (!c) return null;
      if (c.visibility === 'private' && !(authed && c.members)) return null;
      return c;
    };
    const json = (status, body, headers = {}) => ({
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (name) => headers[name.toLowerCase()] ?? null },
      json: async () => body,
    });
    if (u.pathname === '/api/community-skins') {
      const ids = (u.searchParams.get('communities') || '').split(',').filter(Boolean);
      const selected = (u.searchParams.get('selected') || '').split(',').filter(Boolean);
      const official = ids.map((id) => [id, readable(id)]).filter(([, c]) => c && c.official
        && !c.revisions[c.official].withdrawn)
        .map(([id, c]) => ({
          community: { id, name: c.name }, skin_id: c.skinId, revision: c.official,
          schema_version: c.revisions[c.official].doc.schemaVersion, published_at: '2026-09-25T00:00:00.000Z',
          href: `/api/community-skins/${id}/${c.skinId}/${c.official}`,
        }));
      const sel = selected.map((ref) => ref.split(':')).map(([id, skinId, rev]) => {
        const c = readable(id);
        const r = c && c.skinId === skinId && c.revisions[rev];
        if (!r) return null;
        return {
          community: { id, name: c.name }, skin_id: skinId, revision: Number(rev),
          schema_version: r.doc.schemaVersion, published_at: '2026-09-25T00:00:00.000Z',
          official: Number(rev) === c.official, withdrawn: r.withdrawn || null,
          href: r.withdrawn ? null : `/api/community-skins/${id}/${skinId}/${rev}`,
        };
      }).filter(Boolean);
      return json(200, { official, selected: sel });
    }
    const m = /^\/api\/community-skins\/([^/]+)\/([^/]+)\/(\d+)$/.exec(u.pathname);
    if (m) {
      const c = readable(m[1]);
      const r = c && c.skinId === m[2] && c.revisions[m[3]];
      if (!r) return json(404, { error: 'not found' });
      if (r.withdrawn) return json(410, { error: 'withdrawn', withdrawn: r.withdrawn });
      return json(200, {
        community: { id: m[1], name: c.name }, skin_id: m[2], revision: Number(m[3]),
        schema_version: r.doc.schemaVersion, published_at: '2026-09-25T00:00:00.000Z', skin: r.doc,
      }, { 'cache-control': `${c.visibility === 'public' ? 'public' : 'private'}, max-age=31536000, immutable` });
    }
    return json(404, {});
  };
  return server;
}

function setup({ storage = memoryStorage(), server = fakeServer(), signedIn = false, enabled = true } = {}) {
  const doc = fakeDocument();
  const session = { signedIn };
  const changes = [];
  const controller = createSkinController({
    caUrl: 'https://ca.example',
    fetch: (...args) => server.fetch(...args),
    storage,
    headers: () => (session.signedIn ? { Authorization: 'Bearer session' } : {}),
    signedIn: () => session.signedIn,
    enabled,
    apply: (entry) => applySkinToDocument(doc, entry),
    onChange: (state) => changes.push(state),
  });
  controller.hydrate();
  return { controller, doc, storage, server, session, changes };
}

const onPage = (doc) => doc.getElementById(SKIN_STYLE_ID)?.textContent || null;

// ---------------------------------------------------------------------------
// Default: nothing applied, nothing selected

{
  const { controller, doc } = setup();
  assert(onPage(doc) === null && !doc.documentElement.dataset.mcSkin, 'no skin is applied until a member chooses one');
  await controller.refresh(['harbour']);
  assert(controller.state.options.length === 1 && controller.state.options[0].communityName === 'Harbour Collective',
    'discovery lists the official skin of an eligible public community');
  assert(onPage(doc) === null && controller.state.selection === null, 'discovery never activates a skin');
}

// Private discovery needs membership
{
  const signedOut = setup();
  await signedOut.controller.refresh(['harbour', 'cellar']);
  assert(signedOut.controller.state.options.map((o) => o.communityId).join() === 'harbour',
    'a private community skin is not offered signed out');
  const member = setup({ signedIn: true });
  await member.controller.refresh(['harbour', 'cellar']);
  assert(member.controller.state.options.length === 2, 'a member sees their private community skin');
}

// Preview, cancel, explicit apply
{
  const { controller, doc, storage } = setup();
  await controller.refresh(['harbour']);
  const option = controller.state.options[0];
  const preview = await controller.preview(option);
  assert(preview.entry?.name === 'Harbour', 'preview resolves the revision document');
  assert(onPage(doc) === null && storage.getItem(SKIN_SELECTION_KEY) === null,
    'previewing does not touch the page or the saved choice (cancel needs no undo)');
  await controller.select(option);
  assert(onPage(doc)?.includes('--color-bg:#f4f7f8'), 'Use this skin applies it');
  assert(doc.documentElement.dataset.mcSkin === `harbour:${SKIN_A}:1`, 'the page records the applied revision');
  assert(JSON.parse(storage.getItem(SKIN_SELECTION_KEY)).revision === 1, 'the selection is saved locally');
  const cacheKey = revisionCacheKey({ communityId: 'harbour', skinId: SKIN_A, revision: 1 }, 1);
  assert(JSON.parse(storage.getItem(SKIN_REVISIONS_KEY))[cacheKey]?.private === false,
    'revisions are cached by community, skin, schema and revision; public ones are marked shareable');

  controller.restoreDefault();
  assert(onPage(doc) === null && !doc.documentElement.dataset.mcSkin && storage.getItem(SKIN_SELECTION_KEY) === null,
    'restoring the default removes every skin variable at once');
}

// Cached render before refresh, even offline
{
  const storage = memoryStorage();
  const first = setup({ storage });
  await first.controller.refresh(['harbour']);
  await first.controller.select(first.controller.state.options[0]);
  const server = fakeServer();
  server.down = true;
  const next = setup({ storage, server });
  assert(onPage(next.doc)?.includes('--color-bg:#f4f7f8') && server.requests.length === 0,
    'a new page renders the cached selected revision before any network');
  await next.controller.refresh(['harbour']);
  assert(onPage(next.doc)?.includes('--color-bg:#f4f7f8') && next.controller.state.status === 'offline',
    'a provider failure keeps the cached skin rather than flashing the default');
  assert(next.controller.state.notice === null, 'no fallback notice while the cached skin is still valid');
}

// Revision updates are offered, never applied
{
  const { controller, doc, server } = setup();
  await controller.refresh(['harbour']);
  await controller.select(controller.state.options[0]);
  server.communities.harbour.revisions[2] = { doc: { ...HARBOUR, light: { ...HARBOUR.light, page: '#f0f4f5' } } };
  server.communities.harbour.official = 2;
  await controller.refresh(['harbour']);
  assert(controller.state.update?.revision === 2, 'a newer official revision shows as an update');
  assert(onPage(doc).includes('--color-bg:#f4f7f8') && controller.state.selection.revision === 1,
    'publishing does not restyle the member');
  await controller.select(controller.state.update);
  assert(onPage(doc).includes('--color-bg:#f0f4f5') && controller.state.update === null, 'the member can take the update explicitly');
  server.communities.harbour.official = 1;
  await controller.refresh(['harbour']);
  assert(controller.state.selection.revision === 2 && onPage(doc).includes('#f0f4f5'),
    'an organizer rollback does not override the pinned revision');
}

// Withdrawal falls back atomically, explains, and survives reload
{
  const storage = memoryStorage();
  const { controller, doc, server } = setup({ storage });
  await controller.refresh(['harbour']);
  await controller.select(controller.state.options[0]);
  server.communities.harbour.revisions[1].withdrawn = { reason: 'security', at: '2026-09-25T01:00:00.000Z' };
  await controller.refresh(['harbour']);
  assert(onPage(doc) === null, 'a withdrawn revision is removed from the page');
  assert(controller.state.notice?.kind === 'withdrawn' && /security/.test(controller.state.notice.message),
    'the fallback explains the withdrawal reason');
  const reload = setup({ storage, server });
  assert(onPage(reload.doc) === null && reload.controller.state.notice?.kind === 'withdrawn',
    'the withdrawal is remembered offline instead of re-applying the cached document');
}

// Unknown schema version and a malformed cached document
{
  const storage = memoryStorage();
  const { controller, server } = setup({ storage });
  await controller.refresh(['harbour']);
  await controller.select(controller.state.options[0]);
  const key = Object.keys(JSON.parse(storage.getItem(SKIN_REVISIONS_KEY)))[0];
  const map = JSON.parse(storage.getItem(SKIN_REVISIONS_KEY));
  map[key].skin.light.text = '#fdfdfd'; // tampered: fails contrast
  storage.setItem(SKIN_REVISIONS_KEY, JSON.stringify(map));
  server.down = true;
  const reload = setup({ storage, server });
  assert(onPage(reload.doc) === null, 'a cached revision that fails validation is never applied');

  const s2 = setup();
  await s2.controller.refresh(['harbour']);
  await s2.controller.select(s2.controller.state.options[0]);
  s2.server.communities.harbour.revisions[1].doc = { ...HARBOUR, schemaVersion: 2 };
  s2.storage.map.delete(SKIN_REVISIONS_KEY);
  await s2.controller.refresh(['harbour']);
  assert(onPage(s2.doc) === null && s2.controller.state.notice?.kind === 'incompatible',
    'an unsupported schema version falls back to the default with an explanation');
}

// Authorization loss: sign-out and membership loss
{
  const storage = memoryStorage();
  const member = setup({ storage, signedIn: true });
  await member.controller.refresh(['cellar']);
  await member.controller.select(member.controller.state.options[0]);
  assert(onPage(member.doc)?.includes('--color-bg'), 'a member can use their private community skin');
  const cached = () => Object.values(JSON.parse(storage.getItem(SKIN_REVISIONS_KEY) || '{}'));
  assert(cached().some((e) => e.communityId === 'cellar' && e.private === true), 'a private revision is cached as private');

  member.session.signedIn = false;
  clearPrivateCommunityCaches(storage); // what caAuth.signOut runs
  member.controller.signedOut();
  assert(onPage(member.doc) === null && member.controller.state.notice?.kind === 'signed-out',
    'sign-out removes a private skin from the page and explains why');
  assert(!cached().some((e) => e.communityId === 'cellar'), 'sign-out deletes private skin data from the device');
  assert(JSON.parse(storage.getItem(SKIN_SELECTION_KEY))?.communityId === 'cellar',
    'the pin itself is a preference and survives sign-out');

  const lost = setup({ signedIn: true });
  await lost.controller.refresh(['cellar']);
  await lost.controller.select(lost.controller.state.options[0]);
  lost.server.communities.cellar.members = false;
  await lost.controller.refresh(['cellar']);
  assert(onPage(lost.doc) === null && lost.controller.state.notice?.kind === 'unavailable',
    'losing membership falls back to the default');
  assert(!Object.keys(JSON.parse(lost.storage.getItem(SKIN_REVISIONS_KEY) || '{}')).length,
    'losing membership removes the inaccessible revision');
}

// Sync: only the reference crosses devices
{
  const deviceA = setup();
  await deviceA.controller.refresh(['harbour']);
  await deviceA.controller.select(deviceA.controller.state.options[0]);
  const pin = deviceA.controller.state.selection;
  const prefs = normalizeDashboardPreferences({ activeSkin: pin });
  assert(JSON.stringify(Object.keys(prefs.activeSkin)) === '["communityId","skinId","revision"]',
    'the synced preference holds only { communityId, skinId, revision }');
  assert(normalizeDashboardPreferences({ activeSkin: { communityId: 'x', skinId: 'nope', revision: 1 } }).activeSkin === null
    && normalizeDashboardPreferences({ activeSkin: { ...pin, skin: HARBOUR } }).activeSkin.skin === undefined,
    'malformed pins are dropped and skin content never rides along');

  const deviceB = setup();
  deviceB.controller.setSelectionFromSync(prefs.activeSkin);
  assert(onPage(deviceB.doc) === null, 'a synced pin with no local copy waits for its revision instead of guessing');
  await deviceB.controller.refresh(['harbour']);
  assert(onPage(deviceB.doc)?.includes('--color-bg:#f4f7f8'), 'the next refresh fetches and applies the synced revision');
  deviceB.controller.setSelectionFromSync(null);
  assert(onPage(deviceB.doc) === null, 'a synced reset returns the device to the default');
}

// Races: an older refresh cannot overwrite an explicit choice
{
  const { controller, doc, server } = setup();
  await controller.refresh(['harbour']);
  await controller.select(controller.state.options[0]);
  const slow = server.fetch;
  let release;
  server.fetch = (url, init) => (url.includes('?') ? new Promise((resolve) => { release = () => resolve(slow(url, init)); }) : slow(url, init));
  const pending = controller.refresh(['harbour']);
  controller.restoreDefault();
  release();
  await pending;
  assert(onPage(doc) === null, 'a refresh that started before a choice does not resurrect an old skin');
}

// Deployment without skins (PXXI)
{
  const { controller, doc } = setup({
    storage: memoryStorage({ [SKIN_SELECTION_KEY]: JSON.stringify({ communityId: 'harbour', skinId: SKIN_A, revision: 1 }) }),
    enabled: false,
  });
  await controller.refresh(['harbour']);
  assert(onPage(doc) === null && controller.state.selection === null, 'a deployment with skins disabled never applies one');
  const pxxi = createDeploymentConfig({ VITE_PINNED_COMMUNITY_ID: 'philanthropic-xxi' });
  assert(pxxi.skinsEnabled === false && createDeploymentConfig().skinsEnabled === true, 'skins are off only for the PXXI identity');
  const baseline = { selectedCommunityIds: ['cibc'], visibleFeedKeys: ['digest'], network: {}, activeSkin: { communityId: 'harbour', skinId: SKIN_A, revision: 1 } };
  const synced = deploymentSyncPreferences({ selectedCommunityIds: ['philanthropic-xxi'], visibleFeedKeys: ['digest'], network: {}, activeSkin: null }, baseline, pxxi);
  assert(synced.activeSkin?.skinId === SKIN_A, 'PXXI keeps the account skin chosen elsewhere instead of clearing it');
}

// Reference and cache helpers
assert(normalizeSkinRef({ communityId: 'cibc', skinId: SKIN_A, revision: 0 }) === null, 'revision 0 is not a pin');
{
  const storage = memoryStorage({
    [SKIN_REVISIONS_KEY]: JSON.stringify({ a: { private: false }, b: { private: true }, c: {} }),
  });
  clearPrivateSkinRevisions(storage);
  assert(Object.keys(JSON.parse(storage.getItem(SKIN_REVISIONS_KEY))).join() === 'a',
    'only revisions marked public outlive sign-out');
}
assert(DEFAULT_SKIN.name === 'My Community', 'the shared default skin is present for reference');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
