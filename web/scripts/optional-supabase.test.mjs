const { createOptionalSupabaseClient, supabase } = await import('../../extension/src/lib/supabase.js');

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

let calls = 0;
const fakeCreate = (url, key) => {
  calls += 1;
  return { url, key };
};

assert(supabase === null, 'web startup tolerates missing Supabase build variables');
assert(createOptionalSupabaseClient('', 'key', fakeCreate) === null, 'a missing URL disables the fallback client');
assert(createOptionalSupabaseClient('https://example.supabase.co', '', fakeCreate) === null, 'a missing key disables the fallback client');
const configured = createOptionalSupabaseClient('https://example.supabase.co', 'key', fakeCreate);
assert(calls === 1, 'the client factory runs only for complete configuration');
assert(configured?.url === 'https://example.supabase.co' && configured?.key === 'key', 'complete configuration creates the fallback client');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
