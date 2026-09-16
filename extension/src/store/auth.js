import { signal, computed } from '@preact/signals';
import { loginWithBluesky, getStoredSession, logout, hasLegacyAppPasswordSession } from '../lib/oauth-atproto';
import { clearBlueskyState } from './bluesky';
import { platform } from '../lib/platform';

export const blueskyUser = signal(null); // { did, handle }
export const blueskySession = signal(null); // marker { did, handle, pdsUrl } (no tokens)
export const authLoading = signal(true);
export const isConnected = computed(() => blueskyUser.value !== null);
export const legacyBlueskySession = signal(hasLegacyAppPasswordSession());

export async function initAuth() {
  authLoading.value = true;
  const session = await getStoredSession();
  if (session) {
    blueskyUser.value = { did: session.did, handle: session.handle };
    blueskySession.value = session;
  }
  authLoading.value = false;
}

export async function connectBluesky(handle, { communitySignIn = false } = {}) {
  const activePlatform = platform();
  if (communitySignIn) activePlatform.prepareCommunityBlueskySignIn();
  else activePlatform.clearCommunityBlueskySignIn();
  let id;
  try {
    id = await loginWithBluesky(handle);
  } catch (error) {
    if (communitySignIn) activePlatform.clearCommunityBlueskySignIn();
    throw error;
  }
  if (!id) return null;
  blueskyUser.value = { did: id.did, handle: id.handle };
  blueskySession.value = id;
  legacyBlueskySession.value = false;
  return id;
}

export async function disconnectBluesky() {
  await logout();
  blueskyUser.value = null;
  blueskySession.value = null;
  clearBlueskyState();
}
