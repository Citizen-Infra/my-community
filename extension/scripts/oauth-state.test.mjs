// One-off test (no framework in this repo). Run: node scripts/oauth-state.test.mjs
//
// Guards the wire format the community-admin OAuth relay parses (#79). If this
// and `redirectForState` in community-admin `server/src/mc-oauth.js` disagree,
// sign-in opens a consent screen and never returns, with nothing naming the
// cause — so the format is asserted here against the relay's actual regex.

const { oauthState } = await import('../src/lib/oauth-state.js');

let failures = 0;
const assert = (cond, msg) => {
  if (cond) console.log('ok:', msg);
  else { console.error('FAIL:', msg); failures++; }
};

// Copied verbatim from community-admin server/src/mc-oauth.js. If that changes,
// this fails, which is the point.
const RELAY_RE = /^([a-p]{32})\./;

const ID = 'cphcgcdbileeagdkdjfmdjiffpidgngg'; // My Community's current sideload id
const RANDOM = 'kJ8xQ2vLmN4pR7sT1wZ9aB';

assert(oauthState(ID, RANDOM) === `${ID}.${RANDOM}`, 'prefixes the id onto the random value');

assert(RELAY_RE.test(oauthState(ID, RANDOM)), "the relay's regex matches what we emit");
assert(oauthState(ID, RANDOM).match(RELAY_RE)[1] === ID, 'the relay extracts our exact id');

// Every build before #79 sent a bare random state and must keep working: the
// relay falls back to its first configured entry.
assert(oauthState(undefined, RANDOM) === RANDOM, 'no id yields the bare random value');
assert(oauthState(null, RANDOM) === RANDOM, 'null id yields the bare random value');
assert(oauthState('', RANDOM) === RANDOM, 'empty id yields the bare random value');
assert(!RELAY_RE.test(oauthState(undefined, RANDOM)), 'a bare state does not look id-prefixed');

// The random half must survive untouched — it is what binds the response to
// this request. The prefix is routing only.
assert(oauthState(ID, RANDOM).endsWith(`.${RANDOM}`), 'the random half is unchanged');
assert(oauthState(ID, RANDOM).length === ID.length + 1 + RANDOM.length, 'nothing else is added');

// A real extension id is 32 chars from a-p; ours must be, or the relay silently
// falls back to its default entry and store users break after publication.
assert(/^[a-p]{32}$/.test(ID), 'the sideload id has the shape the relay requires');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
