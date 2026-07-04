import { signal, computed } from '@preact/signals';
import { loginWithBluesky, getStoredSession, logout } from '../lib/oauth-atproto';
import { clearBlueskyState } from './bluesky';

export const blueskyUser = signal(null); // { did, handle }
export const blueskySession = signal(null); // marker { did, handle, pdsUrl } (no tokens)
export const authLoading = signal(true);
export const isConnected = computed(() => blueskyUser.value !== null);

export async function initAuth() {
  authLoading.value = true;
  const session = await getStoredSession();
  if (session) {
    blueskyUser.value = { did: session.did, handle: session.handle };
    blueskySession.value = session;
  }
  authLoading.value = false;
}

export async function connectBluesky(handle) {
  const id = await loginWithBluesky(handle);
  blueskyUser.value = { did: id.did, handle: id.handle };
  blueskySession.value = id;
  return id;
}

export async function disconnectBluesky() {
  await logout();
  blueskyUser.value = null;
  blueskySession.value = null;
  clearBlueskyState();
}
