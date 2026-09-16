const KEY = 'mc_web_bluesky_ca_signin';

export function markCommunityBlueskySignIn(storage = sessionStorage) {
  storage.setItem(KEY, '1');
}

export function clearCommunityBlueskySignIn(storage = sessionStorage) {
  storage.removeItem(KEY);
}

export function consumeCommunityBlueskySignIn(storage = sessionStorage) {
  const active = storage.getItem(KEY) === '1';
  storage.removeItem(KEY);
  return active;
}
