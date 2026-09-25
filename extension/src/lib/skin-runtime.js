// Member-side community skins (my-community#18) on top of community-admin's
// contract (community-admin#153, docs/community-skins.md there).
//
// Everything that decides WHAT to render lives here, free of signals, the DOM
// and import.meta.env, so the scripts/*.test.mjs suite can drive it with a fake
// fetch and storage. store/skin.js binds it to signals and the document.
//
// The rules this file exists to keep:
// - A community skin is applied only after an explicit member action. Nothing
//   here selects, updates or re-pins on its own; a newer official revision is
//   reported as `update`, never applied.
// - A skin is applied whole or not at all. Every revision is re-validated
//   with the publication gate before it reaches the page, including one read
//   back from this device's cache, and any failure falls back to the default
//   by removing the skin entirely (no partial token set).
// - The only thing written to the page is the closed variable list from the
//   shared interpreter, with values that passed validation.

import {
  SKIN_CSS_VARIABLES,
  SUPPORTED_SKIN_SCHEMA_VERSIONS,
  skinCssVariables,
  validateSkinForPublish,
} from './community-skin.js';

export const SKIN_SELECTION_KEY = 'mc_skin_selection';
export const SKIN_REVISIONS_KEY = 'mc_skin_revisions';
export const SKIN_STYLE_ID = 'mc-community-skin';
const MAX_BATCH = 50;

const COMMUNITY_ID_RE = /^[a-z0-9][a-z0-9-]{0,99}$/;
const SKIN_ID_RE = /^sk_[0-9a-f]{24}$/;
// Every value the interpreter can produce is a #rrggbb colour, a font stack
// from its fixed table, or a px radius. Anything that could end a declaration
// or open a function (; { } ( ) < > \ :) is refused even so.
const SAFE_VALUE_RE = /^[#A-Za-z0-9 ,'.-]+$/;

const WITHDRAWN_REASONS = {
  incompatible: 'it no longer works with this version of My Community',
  security: 'of a security concern',
  policy: 'of a community policy decision',
};

// ---------------------------------------------------------------------------
// References

// The pin stored in preferences (#152): { communityId, skinId, revision }.
// Anything else is treated as "no community skin".
export function normalizeSkinRef(value) {
  if (!value || typeof value !== 'object') return null;
  const { communityId, skinId, revision } = value;
  if (typeof communityId !== 'string' || !COMMUNITY_ID_RE.test(communityId)) return null;
  if (typeof skinId !== 'string' || !SKIN_ID_RE.test(skinId)) return null;
  if (!Number.isInteger(revision) || revision < 1) return null;
  return { communityId, skinId, revision };
}

export function sameRef(a, b) {
  return !!a && !!b && a.communityId === b.communityId && a.skinId === b.skinId && a.revision === b.revision;
}

function refParam(ref) {
  return `${ref.communityId}:${ref.skinId}:${ref.revision}`;
}

// Cache key: community, skin id, schema version and revision (#18).
export function revisionCacheKey(ref, schemaVersion) {
  return `${ref.communityId}/${ref.skinId}/v${schemaVersion}/r${ref.revision}`;
}

// ---------------------------------------------------------------------------
// Validation + CSS

// Returns the normalized skin for a revision document, or null. A revision is
// usable only if its schema is one this build renders AND it still passes the
// same gate community-admin applied at publication.
export function usableSkin(document) {
  if (!document || typeof document !== 'object') return null;
  if (!SUPPORTED_SKIN_SCHEMA_VERSIONS.includes(document.schemaVersion)) return null;
  const result = validateSkinForPublish(document);
  return result.ok ? result.skin : null;
}

function declarations(vars) {
  const names = Object.keys(vars);
  if (names.length !== SKIN_CSS_VARIABLES.length) throw new Error('unexpected skin variable set');
  return names.map((name) => {
    const value = vars[name];
    if (!SKIN_CSS_VARIABLES.includes(name) || typeof value !== 'string' || !SAFE_VALUE_RE.test(value)) {
      throw new Error('unsafe skin variable');
    }
    return `${name}:${value};`;
  }).join('');
}

// The complete stylesheet for a skin: one rule per mode, keyed on the same
// data-theme attribute the default tokens use, so light/dark/system picks the
// matching palette and a mode switch never mixes palettes. The selectors are
// more specific than variables.css's :root and [data-theme="dark"], so every
// listed variable is overridden in both modes. Throws rather than returning a
// partial sheet.
export function skinStylesheet(skin) {
  const valid = usableSkin(skin);
  if (!valid) throw new Error('skin failed validation');
  const light = declarations(skinCssVariables(valid, 'light'));
  const dark = declarations(skinCssVariables(valid, 'dark'));
  return `:root[data-mc-skin]{${light}}\n:root[data-mc-skin][data-theme="dark"]{${dark}}\n`;
}

// Scoped variables for an in-Settings preview. Never touches the page root.
export function previewVariables(skin, mode) {
  const valid = usableSkin(skin);
  if (!valid) return null;
  const vars = skinCssVariables(valid, mode === 'dark' ? 'dark' : 'light');
  declarations(vars);
  return vars;
}

// Applies (entry) or clears (null) the skin on a document. Atomic: the sheet
// is built before anything is touched, and any failure leaves the default.
export function applySkinToDocument(doc, entry) {
  const root = doc.documentElement;
  let css = null;
  if (entry) {
    try { css = skinStylesheet(entry.skin); } catch { css = null; }
  }
  const existing = doc.getElementById(SKIN_STYLE_ID);
  if (!css) {
    existing?.remove();
    delete root.dataset.mcSkin;
    return false;
  }
  const style = existing || doc.createElement('style');
  style.id = SKIN_STYLE_ID;
  style.textContent = css;
  if (!existing) doc.head.appendChild(style);
  root.dataset.mcSkin = refParam(entry);
  return true;
}

// ---------------------------------------------------------------------------
// Local cache (separate from credentials and feed caches)

function readJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function readSkinRevisions(storage) {
  const map = readJson(storage, SKIN_REVISIONS_KEY, {});
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

function findCached(storage, ref) {
  const map = readSkinRevisions(storage);
  for (const [key, entry] of Object.entries(map)) {
    if (entry && key === revisionCacheKey(ref, entry.schemaVersion)) return entry;
  }
  return null;
}

function writeCached(storage, entry) {
  const map = readSkinRevisions(storage);
  map[revisionCacheKey(entry, entry.schemaVersion)] = entry;
  writeJson(storage, SKIN_REVISIONS_KEY, map);
}

function dropCached(storage, predicate) {
  const map = readSkinRevisions(storage);
  let changed = false;
  for (const [key, entry] of Object.entries(map)) {
    if (predicate(entry)) { delete map[key]; changed = true; }
  }
  if (changed) writeJson(storage, SKIN_REVISIONS_KEY, Object.keys(map).length ? map : null);
}

// Sign-out: a private community's revision is member-only data and leaves
// with the session. Public revisions are cacheable by anyone and stay.
export function clearPrivateSkinRevisions(storage) {
  dropCached(storage, (entry) => entry?.private !== false);
}

// ---------------------------------------------------------------------------
// Notices

function skinLabel(entry, ref) {
  if (entry?.name && entry?.communityName) return `${entry.communityName}'s "${entry.name}" skin`;
  if (entry?.communityName) return `${entry.communityName}'s skin`;
  return `The skin from ${ref.communityId}`;
}

export function fallbackNotice(kind, { entry = null, ref, withdrawn = null } = {}) {
  const label = skinLabel(entry, ref);
  switch (kind) {
    case 'withdrawn':
      return {
        kind,
        message: `${label} (revision ${ref.revision}) was withdrawn because ${WITHDRAWN_REASONS[withdrawn?.reason] || 'the community took it down'}. You're seeing the My Community default.`,
      };
    case 'signed-out':
      return { kind, message: `${label} belongs to a private community. Sign in to use it again; the My Community default is showing until then.` };
    case 'unavailable':
      return { kind, message: `${label} is no longer available to you, so the My Community default is showing.` };
    case 'incompatible':
      return { kind, message: `${label} can't be shown safely by this version of My Community, so the default is showing.` };
    case 'offline':
      return { kind, message: 'Community skins could not be checked. Your current appearance stays as it is.' };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Controller

export function createSkinController({
  caUrl,
  fetch: fetchImpl,
  storage,
  headers = () => ({}),
  signedIn = () => false,
  enabled = true,
  apply = () => {},
  onChange = () => {},
}) {
  const state = {
    selection: null,     // pinned ref, or null for the default
    applied: null,       // cached revision entry currently on the page
    pinned: null,        // { name, communityName } of the pin, even when not applied
    options: [],         // official revisions of eligible communities
    update: null,        // newer official revision for the pinned community
    notice: null,        // why the default is showing when a skin is selected
    status: 'idle',      // 'idle' | 'loading' | 'ready' | 'offline'
  };
  let refreshSeq = 0;

  const emit = () => onChange({ ...state, options: [...state.options] });

  function setApplied(entry) {
    state.applied = entry;
    if (entry) state.pinned = { name: entry.name, communityName: entry.communityName };
    apply(entry);
  }

  function rememberPinned(entry) {
    if (entry?.name || entry?.communityName) {
      state.pinned = { name: entry.name || null, communityName: entry.communityName || null };
    }
  }

  function useDefault(notice = null) {
    setApplied(null);
    state.notice = notice;
  }

  function persistSelection() {
    writeJson(storage, SKIN_SELECTION_KEY, state.selection);
  }

  // Render the selected revision from this device's cache, with no network,
  // so a new tab paints in the right skin before anything refreshes.
  function hydrate() {
    state.selection = enabled ? normalizeSkinRef(readJson(storage, SKIN_SELECTION_KEY, null)) : null;
    state.pinned = null;
    if (!state.selection) {
      useDefault();
      return emit();
    }
    const entry = findCached(storage, state.selection);
    if (entry?.withdrawn) {
      rememberPinned(entry);
      useDefault(fallbackNotice('withdrawn', { entry, ref: state.selection, withdrawn: entry.withdrawn }));
    } else if (entry && usableSkin(entry.skin)) {
      setApplied(entry);
      state.notice = null;
    } else {
      // Either never fetched on this device (e.g. a pin that arrived by sync)
      // or cleared at sign-out. The refresh decides which, and explains.
      if (entry) dropCached(storage, (e) => sameRef(e, state.selection));
      useDefault();
    }
    return emit();
  }

  async function fetchJson(url) {
    const res = await fetchImpl(url, { headers: headers() });
    const body = res.status === 304 ? null : await res.json().catch(() => null);
    return { res, body };
  }

  // Resolve one published revision to a validated cache entry: from the
  // cache, else its revision-addressed URL (immutable, cached for good).
  // Returns { entry } or { error: 'withdrawn'|'unavailable'|'incompatible'|'offline', withdrawn }.
  async function ensureRevision(ref, { href, communityName } = {}) {
    const cached = findCached(storage, ref);
    if (cached?.withdrawn) return { error: 'withdrawn', withdrawn: cached.withdrawn, entry: cached };
    if (cached && usableSkin(cached.skin)) return { entry: cached };
    const path = href || `/api/community-skins/${ref.communityId}/${ref.skinId}/${ref.revision}`;
    let res;
    let body;
    try {
      ({ res, body } = await fetchJson(`${caUrl}${path}`));
    } catch {
      return { error: 'offline' };
    }
    if (res.status === 410) return { error: 'withdrawn', withdrawn: body?.withdrawn || null };
    if (!res.ok || !body) return { error: res.status >= 500 ? 'offline' : 'unavailable' };
    if (body.community?.id !== ref.communityId || body.skin_id !== ref.skinId || body.revision !== ref.revision) {
      return { error: 'unavailable' };
    }
    const skin = usableSkin(body.skin);
    if (!skin || body.schema_version !== skin.schemaVersion) return { error: 'incompatible' };
    const cacheControl = res.headers?.get?.('cache-control') || '';
    const entry = {
      ...ref,
      communityName: body.community.name || communityName || ref.communityId,
      name: skin.name,
      schemaVersion: body.schema_version,
      publishedAt: body.published_at || null,
      // Only a revision the server marked shareable outlives sign-out.
      private: !/(^|[\s,])public([\s,]|$)/.test(cacheControl),
      skin,
    };
    writeCached(storage, entry);
    return { entry };
  }

  function fallbackFor(result, ref, entry) {
    if (result.error === 'withdrawn') {
      const tombstone = {
        ...ref,
        communityName: entry?.communityName || result.entry?.communityName,
        name: entry?.name || result.entry?.name,
        schemaVersion: entry?.schemaVersion || result.entry?.schemaVersion || 1,
        private: entry?.private ?? true,
        withdrawn: result.withdrawn || { reason: null, at: null },
      };
      dropCached(storage, (e) => sameRef(e, ref));
      writeCached(storage, tombstone);
      rememberPinned(tombstone);
      return fallbackNotice('withdrawn', { entry: tombstone, ref, withdrawn: tombstone.withdrawn });
    }
    if (result.error === 'unavailable') {
      dropCached(storage, (e) => sameRef(e, ref));
      return fallbackNotice(signedIn() ? 'unavailable' : 'signed-out', { entry, ref });
    }
    if (result.error === 'incompatible') {
      dropCached(storage, (e) => sameRef(e, ref));
      return fallbackNotice('incompatible', { entry, ref });
    }
    return null;
  }

  // The pointer refresh. Discovers official skins for the given communities
  // and checks the pinned revision. Never changes the selection.
  async function refresh(communityIds = []) {
    if (!enabled) return emit();
    const seq = ++refreshSeq;
    const selection = state.selection;
    const ids = [...new Set([
      ...communityIds.filter((id) => COMMUNITY_ID_RE.test(id)),
      ...(selection ? [selection.communityId] : []),
    ])].slice(0, MAX_BATCH);
    if (!ids.length) {
      state.options = [];
      state.update = null;
      state.status = 'ready';
      return emit();
    }
    state.status = 'loading';
    emit();
    const params = new URLSearchParams({ communities: ids.join(',') });
    if (selection) params.set('selected', refParam(selection));
    let res;
    let body;
    try {
      ({ res, body } = await fetchJson(`${caUrl}/api/community-skins?${params}`));
    } catch {
      res = null;
    }
    if (seq !== refreshSeq) return undefined;
    if (!res || !res.ok || !body || !Array.isArray(body.official) || !Array.isArray(body.selected)) {
      // Provider failure: keep whatever is on the page. A valid cached skin
      // stays applied; nothing half-applies.
      state.status = 'offline';
      if (!state.applied && selection && !state.notice) state.notice = fallbackNotice('offline', { ref: selection });
      return emit();
    }

    state.options = body.official
      .filter((row) => SUPPORTED_SKIN_SCHEMA_VERSIONS.includes(row.schema_version)
        && COMMUNITY_ID_RE.test(row.community?.id || '') && SKIN_ID_RE.test(row.skin_id || ''))
      .map((row) => ({
        communityId: row.community.id,
        communityName: row.community.name || row.community.id,
        skinId: row.skin_id,
        revision: row.revision,
        schemaVersion: row.schema_version,
        publishedAt: row.published_at || null,
        href: row.href,
      }));

    if (!selection || !sameRef(selection, state.selection)) {
      state.update = null;
      state.status = 'ready';
      return emit();
    }

    const official = state.options.find((o) => o.communityId === selection.communityId);
    state.update = official && !sameRef(official, selection) ? official : null;
    const pinned = body.selected.find((row) => row.community?.id === selection.communityId
      && row.skin_id === selection.skinId && row.revision === selection.revision);
    const cached = findCached(storage, selection);

    let result;
    if (!pinned) result = { error: 'unavailable' };
    else if (pinned.withdrawn) result = { error: 'withdrawn', withdrawn: pinned.withdrawn };
    else if (!SUPPORTED_SKIN_SCHEMA_VERSIONS.includes(pinned.schema_version)) result = { error: 'incompatible' };
    else result = await ensureRevision(selection, { href: pinned.href, communityName: pinned.community?.name });
    if (seq !== refreshSeq || !sameRef(selection, state.selection)) return undefined;

    if (result.entry && !result.error) {
      setApplied(result.entry);
      state.notice = null;
      state.status = 'ready';
    } else if (result.error === 'offline') {
      state.status = 'offline';
      if (!state.applied) state.notice = fallbackNotice('offline', { ref: selection });
    } else {
      useDefault(fallbackFor(result, selection, cached && !cached.withdrawn ? cached : result.entry));
      state.status = 'ready';
    }
    return emit();
  }

  // Preview: fetch and validate only. The selection and the page are untouched,
  // so cancelling a preview needs no undo.
  async function preview(option) {
    const ref = normalizeSkinRef(option);
    if (!ref) return { error: 'unavailable' };
    const result = await ensureRevision(ref, option);
    return result.entry ? { entry: result.entry } : { error: result.error };
  }

  // "Use this skin": the only way a community skin becomes active.
  async function select(option) {
    if (!enabled) return { error: 'unavailable' };
    const ref = normalizeSkinRef(option);
    if (!ref) return { error: 'unavailable' };
    const result = await ensureRevision(ref, option);
    if (!result.entry || result.error) return { error: result.error || 'unavailable' };
    refreshSeq += 1; // an older refresh must not overwrite an explicit choice
    state.selection = ref;
    persistSelection();
    setApplied(result.entry);
    state.notice = null;
    const official = state.options.find((o) => o.communityId === ref.communityId);
    state.update = official && !sameRef(official, ref) ? official : null;
    emit();
    return { entry: result.entry };
  }

  function restoreDefault() {
    refreshSeq += 1;
    state.selection = null;
    state.pinned = null;
    state.update = null;
    persistSelection();
    useDefault();
    emit();
  }

  // A pin that arrived through account preferences (#152). Applied from the
  // cache when this device has it; otherwise the next refresh fetches it.
  function setSelectionFromSync(value) {
    const ref = enabled ? normalizeSkinRef(value) : null;
    if (sameRef(ref, state.selection) || (!ref && !state.selection)) return false;
    refreshSeq += 1;
    writeJson(storage, SKIN_SELECTION_KEY, ref);
    hydrate();
    return true;
  }

  // Sign-out or lost access: private revisions leave this device, and a
  // private skin on the page falls back with an explanation.
  function signedOut() {
    clearPrivateSkinRevisions(storage);
    if (state.applied && state.applied.private !== false) {
      const entry = state.applied;
      useDefault(fallbackNotice('signed-out', { entry, ref: entry }));
    }
    // Options may include private communities; the next refresh repopulates
    // whatever is still readable signed out.
    state.options = [];
    state.update = null;
    emit();
  }

  return {
    state,
    hydrate,
    refresh,
    preview,
    select,
    restoreDefault,
    setSelectionFromSync,
    signedOut,
  };
}
