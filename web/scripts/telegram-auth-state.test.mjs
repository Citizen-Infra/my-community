import {
  clearTelegramSignInState,
  readTelegramSignInState,
  rememberTelegramSignInState,
} from '../../extension/src/lib/telegram-auth-state.js';

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures += 1; }
};

class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const storage = new MemoryStorage();
const first = 'first-opaque-state-value';
const second = 'second-opaque-state-value';
rememberTelegramSignInState(first, storage, 1000);
rememberTelegramSignInState(second, storage, 2000);
assert(readTelegramSignInState(first, storage).createdAt === 1000, 'a second tab does not overwrite the first Telegram flow');
assert(readTelegramSignInState(second, storage).createdAt === 2000, 'each Telegram flow retains its own browser state');

clearTelegramSignInState(first, storage);
assert(readTelegramSignInState(first, storage) === null, 'completing one flow clears only that flow');
assert(readTelegramSignInState(second, storage).value === second, 'clearing one flow leaves another tab intact');

clearTelegramSignInState(undefined, storage);
assert(storage.length === 0, 'sign-out clears every pending Telegram flow');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
