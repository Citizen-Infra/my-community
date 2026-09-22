import { pollTelegramAuth, requestTelegramAuth } from '../src/telegram-auth.js';

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
    async json() { return calls.length === 1 ? { nonce: 'nonce', link: 'https://t.me/bot?start=nonce' } : { status: 'pending' }; },
  };
};

const pending = await requestTelegramAuth({
  community: 'philanthropic-xxi', intent: 'link', state: 'opaque-state-value-123456',
}, {
  baseUrl: 'https://admin.example',
  headers: { Authorization: 'Bearer session' },
  fetchImpl,
});
assert(pending.nonce === 'nonce', 'opens a pending Telegram flow');
assert(calls[0].url === 'https://admin.example/auth/telegram/pending', 'uses the pending endpoint');
assert(calls[0].options.headers.Authorization === 'Bearer session', 'link intent carries the current browser session');
assert(JSON.parse(calls[0].options.body).community === 'philanthropic-xxi', 'the pinned community is explicit');

await pollTelegramAuth({ nonce: pending.nonce, state: 'opaque-state-value-123456' }, {
  baseUrl: 'https://admin.example', fetchImpl,
});
assert(calls[1].url === 'https://admin.example/auth/telegram/poll', 'polls the completion endpoint');
assert(!('Authorization' in calls[1].options.headers), 'polling does not expose the browser session');

await requestTelegramAuth({ community: 'philanthropic-xxi', intent: 'signin', state: 'opaque-state-value-123456' }, {
  baseUrl: 'https://admin.example', fetchImpl,
});
assert(!('Authorization' in calls[2].options.headers), 'sign-in intent remains unauthenticated');

for (const [status, text] of [[503, 'not available'], [409, 'saved layouts'], [400, 'expired']]) {
  try {
    await requestTelegramAuth({ community: 'philanthropic-xxi', intent: 'signin', state: 'opaque-state-value-123456' }, {
      baseUrl: 'https://admin.example',
      fetchImpl: async () => ({ ok: false, status }),
    });
    assert(false, `${status} becomes a useful message`);
  } catch (error) {
    assert(error.message.includes(text), `${status} becomes a useful message`);
  }
}

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
