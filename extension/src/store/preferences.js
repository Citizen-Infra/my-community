import { effect, signal } from '@preact/signals';
import { CA_URL } from '../lib/config';
import {
  normalizeDashboardPreferences,
  preferencesMatch,
  SUPPORTING_TILE_KEYS,
} from '../lib/dashboard-preferences';
import { selectedCommunityIds } from './communities';
import {
  previewDepths,
  tabOrder,
  visibleTabs,
} from './panels';
import {
  blueskyFeedUri,
  blueskyShowReposts,
  blueskyTimeWindow,
  blueskyWeightedSort,
} from './bluesky';
import { caSessionHeader, signOut } from './caAuth';
import { replaceSupportingTileKeys, visibleSupportingTileKeys } from './supporting';

const ACCOUNT_KEY = 'mc_preferences_account';
const SIGNED_OUT_KEY = 'mc_signed_out_preferences';
const CACHE_PREFIX = 'mc_preferences_cache:';

export const preferenceStatus = signal('local');
export const preferenceMessage = signal('Saved on this device');
export const preferencePrompt = signal(null);

let activeAccount = null;
let revision = null;
let stopWatching = null;
let writeTimer = null;
let applying = false;
let queuedSnapshot = null;
let lastSaved = null;

function cacheKey(account) { return `${CACHE_PREFIX}${account}`; }

function parseStored(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}

export function currentDashboardPreferences() {
  return normalizeDashboardPreferences({
    revision,
    selectedCommunityIds: selectedCommunityIds.value,
    visibleFeedKeys: Object.entries(visibleTabs.value).filter(([, visible]) => visible).map(([key]) => key),
    feedOrder: tabOrder.value,
    previewDepths: previewDepths.value,
    network: {
      source: blueskyFeedUri.value,
      timeWindow: blueskyTimeWindow.value,
      showReposts: blueskyShowReposts.value,
      ranking: blueskyWeightedSort.value ? 'most-discussed' : 'most-liked',
    },
    visibleSupportingTileKeys: visibleSupportingTileKeys.value,
    activeSkin: null,
  });
}

export function applyDashboardPreferences(value) {
  const next = normalizeDashboardPreferences(value);
  applying = true;
  selectedCommunityIds.value = next.selectedCommunityIds;
  localStorage.setItem('mc_communities', JSON.stringify(next.selectedCommunityIds));
  visibleTabs.value = Object.fromEntries(Object.keys(visibleTabs.value).map((key) => [key, next.visibleFeedKeys.includes(key)]));
  localStorage.setItem('mc_visible_tabs', JSON.stringify(visibleTabs.value));
  tabOrder.value = next.feedOrder;
  localStorage.setItem('mc_dashboard_tab_order', JSON.stringify(next.feedOrder));
  previewDepths.value = next.previewDepths;
  localStorage.setItem('mc_dashboard_preview_depths', JSON.stringify(next.previewDepths));
  blueskyFeedUri.value = next.network.source;
  blueskyTimeWindow.value = next.network.timeWindow;
  blueskyShowReposts.value = next.network.showReposts;
  blueskyWeightedSort.value = next.network.ranking === 'most-discussed';
  localStorage.setItem('mc_bluesky_feed', next.network.source);
  localStorage.setItem('mc_bluesky_window', next.network.timeWindow);
  localStorage.setItem('mc_bluesky_reposts', String(next.network.showReposts));
  localStorage.setItem('mc_bluesky_weighted', String(next.network.ranking === 'most-discussed'));
  replaceSupportingTileKeys(next.visibleSupportingTileKeys);
  revision = next.revision;
  queueMicrotask(() => { applying = false; });
  return next;
}

async function fetchRemote() {
  const res = await fetch(`${CA_URL}/auth/preferences/my-community`, { headers: caSessionHeader() });
  if (res.status === 401) {
    await signOut();
    throw new Error('Your sign-in has expired.');
  }
  if (!res.ok) throw new Error('Saved layout is temporarily unavailable.');
  return (await res.json()).preferences;
}

function cacheRemote(account, preferences) {
  localStorage.setItem(cacheKey(account), JSON.stringify(preferences));
  localStorage.setItem(ACCOUNT_KEY, account);
}

function watchChanges() {
  stopWatching?.();
  stopWatching = effect(() => {
    const snapshot = currentDashboardPreferences();
    // Read every participating signal before the guard so the effect tracks it.
    visibleSupportingTileKeys.value;
    if (applying || !activeAccount || !['synced', 'error'].includes(preferenceStatus.peek())) return;
    if (preferencesMatch(snapshot, lastSaved)) return;
    queuedSnapshot = snapshot;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => void writePreferences(queuedSnapshot), 900);
  });
}

async function writePreferences(snapshot) {
  if (!activeAccount) return;
  if (!navigator.onLine) {
    preferenceStatus.value = 'error';
    preferenceMessage.value = 'Offline — changes are waiting on this device';
    return;
  }
  preferenceStatus.value = 'saving';
  preferenceMessage.value = 'Saving layout…';
  const preferences = normalizeDashboardPreferences({ ...snapshot, revision });
  try {
    const res = await fetch(`${CA_URL}/auth/preferences/my-community`, {
      method: 'PUT',
      headers: { ...caSessionHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences }),
    });
    if (res.status === 401) {
      await signOut();
      throw new Error('Your sign-in has expired.');
    }
    if (res.status === 409) {
      const remote = await fetchRemote();
      preferenceStatus.value = 'conflict';
      preferenceMessage.value = 'A newer saved layout needs your review';
      preferencePrompt.value = { kind: 'conflict', local: currentDashboardPreferences(), remote };
      return;
    }
    if (!res.ok) throw new Error('Could not save layout.');
    const saved = (await res.json()).preferences;
    revision = saved.revision;
    lastSaved = saved;
    cacheRemote(activeAccount, saved);
    preferenceStatus.value = 'synced';
    preferenceMessage.value = 'Layout saved across devices';
  } catch (error) {
    preferenceStatus.value = 'error';
    preferenceMessage.value = error.message || 'Could not save layout';
  }
}

export async function beginPreferenceContinuity(account) {
  if (!account || activeAccount === account) return;
  stopWatching?.();
  clearTimeout(writeTimer);
  const local = currentDashboardPreferences();
  const previousAccount = localStorage.getItem(ACCOUNT_KEY);
  if (!previousAccount) localStorage.setItem(SIGNED_OUT_KEY, JSON.stringify(local));
  activeAccount = account;
  preferenceStatus.value = 'loading';
  preferenceMessage.value = 'Checking your saved layout…';

  const cached = parseStored(cacheKey(account));
  if (previousAccount === account && cached) applyDashboardPreferences(cached);

  try {
    const remote = await fetchRemote();
    if (previousAccount === account) {
      if (remote) {
        const applied = applyDashboardPreferences(remote);
        lastSaved = applied;
        cacheRemote(account, applied);
      }
      preferenceStatus.value = 'synced';
      preferenceMessage.value = 'Layout saved across devices';
      watchChanges();
      return;
    }
    if (!remote) {
      revision = null;
      preferenceStatus.value = 'reconcile';
      preferenceMessage.value = 'Choose how to start cross-device sync';
      preferencePrompt.value = { kind: 'save-local', local };
      return;
    }
    if (preferencesMatch(local, remote)) {
      const applied = applyDashboardPreferences(remote);
      lastSaved = applied;
      cacheRemote(account, applied);
      preferenceStatus.value = 'synced';
      preferenceMessage.value = 'Layout saved across devices';
      watchChanges();
      return;
    }
    revision = remote.revision;
    preferenceStatus.value = 'reconcile';
    preferenceMessage.value = 'Choose which dashboard layout to keep';
    preferencePrompt.value = { kind: 'choose', local, remote };
  } catch (error) {
    preferenceStatus.value = 'error';
    preferenceMessage.value = error.message || 'Saved layout is unavailable';
  }
}

export function startSignedOutPreferenceProfile() {
  if (activeAccount) return;
  stopWatching?.();
  stopWatching = effect(() => {
    localStorage.setItem(SIGNED_OUT_KEY, JSON.stringify(currentDashboardPreferences()));
  });
}

export async function resolvePreferencePrompt(choice) {
  const prompt = preferencePrompt.value;
  if (!prompt || !activeAccount) return;
  preferencePrompt.value = null;
  if (choice === 'remote' && prompt.remote) {
    const applied = applyDashboardPreferences(prompt.remote);
    lastSaved = applied;
    cacheRemote(activeAccount, applied);
    preferenceStatus.value = 'synced';
    preferenceMessage.value = 'Using your saved layout';
    watchChanges();
    return;
  }
  if (choice === 'local') {
    revision = prompt.remote?.revision ?? null;
    await writePreferences(prompt.local);
    if (preferenceStatus.value === 'synced') watchChanges();
    return;
  }
  preferenceStatus.value = 'local';
  preferenceMessage.value = 'Layout stays on this device';
}

export function endPreferenceContinuity() {
  stopWatching?.();
  stopWatching = null;
  clearTimeout(writeTimer);
  activeAccount = null;
  revision = null;
  lastSaved = null;
  preferencePrompt.value = null;
  const signedOut = parseStored(SIGNED_OUT_KEY);
  if (signedOut) applyDashboardPreferences(signedOut);
  preferenceStatus.value = 'local';
  preferenceMessage.value = 'Saved on this device';
  startSignedOutPreferenceProfile();
}

export function retryPreferenceSync() {
  if (activeAccount) return writePreferences(currentDashboardPreferences()).then(() => {
    if (preferenceStatus.value === 'synced') watchChanges();
  });
  return Promise.resolve();
}

export const supportingTileOptions = SUPPORTING_TILE_KEYS;
