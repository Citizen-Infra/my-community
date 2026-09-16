const { canUseNetworkAction } = await import('../src/offline-policy.js');

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

assert(canUseNetworkAction(false, 'read-cache'), 'cached content stays readable offline');
assert(!canUseNetworkAction(false, 'outward-action'), 'outward actions stop offline');
assert(canUseNetworkAction(true, 'outward-action'), 'outward actions resume online');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
