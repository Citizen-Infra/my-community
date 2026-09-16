const { validWebCallbackState } = await import('../../extension/src/lib/web-auth-state.js');

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

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
