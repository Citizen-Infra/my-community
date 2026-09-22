const TELEGRAM_STATE_PREFIX = 'mc_web_telegram_state:';
const LEGACY_TELEGRAM_STATE_KEY = 'mc_web_telegram_state';

function stateKey(state) {
  return `${TELEGRAM_STATE_PREFIX}${state}`;
}

export function rememberTelegramSignInState(state, storage = globalThis.localStorage, now = Date.now()) {
  storage.setItem(stateKey(state), JSON.stringify({ value: state, createdAt: now }));
}

export function readTelegramSignInState(state, storage = globalThis.localStorage) {
  try {
    return JSON.parse(storage.getItem(stateKey(state)) || 'null');
  } catch {
    return null;
  }
}

export function clearTelegramSignInState(state, storage = globalThis.localStorage) {
  if (state) {
    storage.removeItem(stateKey(state));
    return;
  }

  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(TELEGRAM_STATE_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  storage.removeItem(LEGACY_TELEGRAM_STATE_KEY);
}
