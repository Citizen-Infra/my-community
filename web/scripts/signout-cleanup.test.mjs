const { clearPrivateCommunityCaches, PRIVATE_COMMUNITY_CACHE_KEYS } = await import('../../extension/src/lib/private-data.js');

const values = new Map(PRIVATE_COMMUNITY_CACHE_KEYS.map((key) => [key, 'private data']));
values.set('mc_signed_out_preferences', 'keep me');
clearPrivateCommunityCaches({ removeItem: (key) => values.delete(key) });

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

assert(PRIVATE_COMMUNITY_CACHE_KEYS.every((key) => !values.has(key)), 'sign-out clears every private community cache');
assert(values.get('mc_signed_out_preferences') === 'keep me', 'sign-out preserves the separate signed-out profile');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
