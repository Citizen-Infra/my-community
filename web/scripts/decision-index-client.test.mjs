import { DecisionIndexRequestError, fetchDecisionIndex } from '../../extension/src/lib/brain-decisions-client.js';

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

const calls = [];
const fetchImpl = async (url, options) => {
  calls.push({ url, options });
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === 'cache-control' ? 'private, no-store' : null },
    async json() {
      return {
        count: 2,
        decisions: [
          { date: '2026-09-23', path: '2026-09-23-open.md', status: 'needs-response', title: 'Needs a response' },
          { date: '2026-09-22', path: '2026-09-22-done.md', status: 'resolved', title: 'Already decided' },
        ],
      };
    },
  };
};

const result = await fetchDecisionIndex({
  apiBase: 'https://crapotkin.example',
  fetchImpl,
  getTokenImpl: async () => 'member-jwt',
});
assert(result.length === 2, 'returns every validated decision record');
assert(result[0].href === '/decisions/2026-09-23-open.md', 'derives the internal detail route from the validated path');
assert(calls[0].url.href === 'https://crapotkin.example/api/decisions', 'uses the metadata-only index endpoint without a path query');
assert(calls[0].options.cache === 'no-store' && calls[0].options.credentials === 'omit', 'private metadata bypasses browser caches and cookies');
assert(calls[0].options.headers.Authorization === 'Bearer member-jwt', 'the short-lived member JWT gates the index');

async function rejects(run, message) {
  try { await run(); assert(false, message); }
  catch (error) { assert(error instanceof DecisionIndexRequestError, message); }
}

await rejects(() => fetchDecisionIndex({
  apiBase: 'https://crapotkin.example',
  getTokenImpl: async () => 'jwt',
  fetchImpl: async () => ({
    ok: true,
    headers: { get: () => 'private, no-store' },
    async json() {
      return { count: 1, decisions: [{ date: '2026-09-23', path: 'valid.md', status: 'invented', title: 'Invalid' }] };
    },
  }),
}), 'rejects lifecycle values outside the approved contract');

await rejects(() => fetchDecisionIndex({
  apiBase: 'https://crapotkin.example',
  getTokenImpl: async () => 'jwt',
  fetchImpl: async () => ({ ok: true, headers: { get: () => null }, async json() { return { count: 0, decisions: [] }; } }),
}), 'rejects cacheable private metadata');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
