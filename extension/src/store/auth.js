import { signal, computed } from '@preact/signals';
import { createSession, getValidSession, clearSession } from '../lib/atproto';
import { clearBlueskyState } from './bluesky';

export const blueskyUser = signal(null); // { did, handle }
export const blueskySession = signal(null); // Full session with tokens
export const authLoading = signal(true);
export const isConnected = computed(() => blueskyUser.value !== null);

export async function initAuth() {
  authLoading.value = true;
  const session = await getValidSession();
  if (session) {
    blueskyUser.value = { did: session.did, handle: session.handle };
    blueskySession.value = session;
  }
  authLoading.value = false;
}

export async function connectBluesky(handle, appPassword) {
  const session = await createSession(handle, appPassword);
  blueskyUser.value = { did: session.did, handle: session.handle };
  blueskySession.value = session;
  return session;
}

export function disconnectBluesky() {
  clearSession();
  blueskyUser.value = null;
  blueskySession.value = null;
  clearBlueskyState();
}
