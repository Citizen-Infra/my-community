const { validWebCallbackState } = await import('../../extension/src/lib/web-auth-state.js');
const {
  clearCommunityBlueskySignIn,
  consumeCommunityBlueskySignIn,
  markCommunityBlueskySignIn,
} = await import('../src/bluesky-signin-intent.js');

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

const expected = 'opaque-state-value-123456';
assert(validWebCallbackState(expected, expected), 'accepts the callback bound to this browser flow');
assert(!validWebCallbackState(expected, 'opaque-state-value-654321'), 'rejects a different callback state');
assert(!validWebCallbackState(null, expected), 'rejects callbacks without a stored state');
assert(!validWebCallbackState('short', 'short'), 'rejects undersized stored state');

const values = new Map();
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
markCommunityBlueskySignIn(storage);
assert(consumeCommunityBlueskySignIn(storage), 'consumes community-account intent exactly once');
assert(!consumeCommunityBlueskySignIn(storage), 'consumed intent cannot affect a later Network-only login');
markCommunityBlueskySignIn(storage);
clearCommunityBlueskySignIn(storage);
assert(!consumeCommunityBlueskySignIn(storage), 'failed or superseded OAuth clears community-account intent');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
