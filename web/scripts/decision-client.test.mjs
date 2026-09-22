import { DecisionRequestError, fetchDecision } from '../src/decision-client.js';

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
    async json() { return { path: 'working/example.md', markdown: '# Complete decision' }; },
  };
};

const result = await fetchDecision('working/example.md', {
  apiBase: 'https://crapotkin.example',
  fetchImpl,
  getTokenImpl: async () => 'member-jwt',
});
assert(result.markdown === '# Complete decision', 'a matching no-store response is returned in memory');
assert(calls[0].url.origin === 'https://crapotkin.example' && calls[0].url.pathname === '/api/decisions', 'the configured Crapotkin origin is used');
assert(calls[0].url.searchParams.get('path') === 'working/example.md', 'the validated decision path is the only query value');
assert(calls[0].options.cache === 'no-store' && calls[0].options.credentials === 'omit', 'the request bypasses caches and cookies');
assert(calls[0].options.referrerPolicy === 'no-referrer', 'the member route is not sent as a referrer');
assert(calls[0].options.headers.Authorization === 'Bearer member-jwt', 'the short-lived member JWT gates the request');

async function rejectsWithStatus(run, status, message) {
  try { await run(); assert(false, message); }
  catch (error) { assert(error instanceof DecisionRequestError && error.status === status, message); }
}

await rejectsWithStatus(() => fetchDecision('example.md', {
  apiBase: 'https://crapotkin.example', fetchImpl, getTokenImpl: async () => null,
}), 401, 'a missing member token returns to the sign-in state');
await rejectsWithStatus(() => fetchDecision('example.md', {
  apiBase: 'https://crapotkin.example', getTokenImpl: async () => 'jwt',
  fetchImpl: async () => ({ ok: false, status: 403, headers: { get: () => 'private, no-store' } }),
}), 403, 'a non-member response remains distinct');
await rejectsWithStatus(() => fetchDecision('example.md', {
  apiBase: 'https://crapotkin.example', getTokenImpl: async () => 'jwt',
  fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, async json() { return { path: 'example.md', markdown: 'body' }; } }),
}), 503, 'a cacheable private response fails closed');
await rejectsWithStatus(() => fetchDecision('example.md', {
  apiBase: 'https://crapotkin.example', getTokenImpl: async () => 'jwt',
  fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => 'no-store' }, async json() { return { path: 'other.md', markdown: 'body' }; } }),
}), 503, 'a mismatched response path fails closed');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
