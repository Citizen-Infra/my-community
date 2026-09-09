// One-off test (no framework in this repo). Run: node scripts/tab-manager-mode.test.mjs
//
// The save guards live in the service worker because toolbar and command events
// can fire with no new-tab page open. Execute that worker against a small Chrome
// mock so dashboard-only mode can never regress into silently saving and closing
// a tab that the user has no visible collection UI to recover.

import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  TAB_MANAGER_ENABLED_KEY,
  storedTabManagerEnabled,
} from '../src/lib/tab-manager-mode.js';

const source = await readFile(new URL('../public/background.js', import.meta.url), 'utf8');

let failures = 0;
const assert = (condition, message) => {
  if (condition) console.log('ok:', message);
  else { console.error('FAIL:', message); failures++; }
};

assert(storedTabManagerEnabled(undefined), 'missing preference preserves the enabled-by-default behavior');
assert(storedTabManagerEnabled(true), 'stored true enables the tab manager');
assert(!storedTabManagerEnabled(false), 'only stored false enables dashboard-only mode');
assert(TAB_MANAGER_ENABLED_KEY === 'mc_tab_manager_enabled', 'new-tab and worker surfaces share the documented preference key');

function makeEvent() {
  let listener;
  return {
    addListener(next) { listener = next; },
    invoke(...args) { return listener?.(...args); },
  };
}

function createWorker(initialStorage = {}) {
  const storage = { ...initialStorage };
  const calls = {
    badges: [],
    fetches: [],
    removedTabs: [],
    titles: [],
    toasts: [],
  };
  const events = {
    actionClicked: makeEvent(),
    alarm: makeEvent(),
    command: makeEvent(),
    installed: makeEvent(),
    message: makeEvent(),
    storageChanged: makeEvent(),
    tabUpdated: makeEvent(),
  };

  const getStorage = (keys) => {
    const names = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(names.map((key) => [key, storage[key]]));
  };

  const chrome = {
    action: {
      onClicked: events.actionClicked,
      setBadgeBackgroundColor() {},
      setBadgeText({ text }) { calls.badges.push(text); },
      setTitle({ title }) { calls.titles.push(title); },
    },
    alarms: {
      create() {},
      onAlarm: events.alarm,
    },
    commands: { onCommand: events.command },
    downloads: { download() {} },
    runtime: {
      getURL: (path) => path,
      onInstalled: events.installed,
      onMessage: events.message,
      sendMessage: async () => {},
    },
    scripting: {
      async executeScript({ args }) { calls.toasts.push(args[0]); },
    },
    storage: {
      local: {
        get(keys, callback) {
          const result = getStorage(keys);
          if (callback) { callback(result); return; }
          return Promise.resolve(result);
        },
        set(values, callback) {
          Object.assign(storage, values);
          callback?.();
          return Promise.resolve();
        },
      },
      onChanged: events.storageChanged,
    },
    tabs: {
      onUpdated: events.tabUpdated,
      query(_query, callback) {
        const tabs = [{ id: 42, title: 'Example', url: 'https://example.com' }];
        if (callback) { callback(tabs); return; }
        return Promise.resolve(tabs);
      },
      remove(id) { calls.removedTabs.push(id); },
      update() {},
    },
  };

  const context = vm.createContext({
    URL,
    chrome,
    console,
    crypto: globalThis.crypto,
    decodeURIComponent,
    fetch: async (url) => {
      calls.fetches.push(url);
      return { status: 201 };
    },
    navigator: {},
    setTimeout: (fn) => { fn(); return 1; },
  });
  vm.runInContext(source, context);

  return { calls, events, storage };
}

const disabled = createWorker({
  mc_tab_manager_enabled: false,
  'tab-hoarder-toolbar-target': 'saved-tabs',
});
await disabled.events.actionClicked.invoke({ id: 42, title: 'Example', url: 'https://example.com' });
assert(disabled.calls.removedTabs.length === 0, 'disabled toolbar save keeps the current tab open');
assert(disabled.calls.badges.includes('OFF'), 'disabled toolbar save shows an OFF badge');
assert(disabled.calls.toasts.some((text) => text.includes('Tab Manager is off')), 'disabled toolbar save explains how to restore saving');
assert(disabled.calls.titles.includes('Tab Manager is off'), 'disabled save target has an accurate toolbar tooltip');

disabled.calls.badges.length = 0;
disabled.calls.toasts.length = 0;
await disabled.events.command.invoke('save-to-recent');
assert(disabled.calls.removedTabs.length === 0, 'disabled Alt+S keeps the current tab open');
assert(disabled.calls.badges.includes('OFF'), 'disabled Alt+S shows an OFF badge');
assert(disabled.calls.toasts.some((text) => text.includes('Tab Manager is off')), 'disabled Alt+S shows the same recovery notice');

const wiki = createWorker({
  mc_tab_manager_enabled: false,
  'tab-hoarder-toolbar-target': 'wiki-queue',
  mc_ca_session_bg: 'session-token',
  mc_communities_bg: [{ id: 'cibc', name: 'CIBC' }],
});
await wiki.events.actionClicked.invoke({ id: 42, title: 'Example', url: 'https://example.com' });
assert(wiki.calls.fetches.length === 1, 'wiki suggestion still runs in dashboard-only mode');
assert(wiki.calls.removedTabs.length === 0, 'wiki suggestion continues to leave the current tab open');
assert(!wiki.calls.badges.includes('OFF'), 'wiki suggestion is not mislabeled as a blocked save');
assert(wiki.calls.titles.includes('Suggest page to the community wiki'), 'wiki target keeps its accurate toolbar tooltip');

console.log(failures === 0 ? '\nall passed' : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
