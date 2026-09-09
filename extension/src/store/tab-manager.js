import { signal } from '@preact/signals';
import { searchQuery } from './search';
import { showDashboard } from './view';
import { TAB_MANAGER_ENABLED_KEY, storedTabManagerEnabled } from '../lib/tab-manager-mode';

export const tabManagerEnabled = signal(true);

export async function initTabManager() {
  const result = await chrome.storage.local.get(TAB_MANAGER_ENABLED_KEY);
  const enabled = storedTabManagerEnabled(result?.[TAB_MANAGER_ENABLED_KEY]);
  tabManagerEnabled.value = enabled;
  return enabled;
}

export async function setTabManagerEnabled(enabled) {
  const next = Boolean(enabled);
  // Persist the worker-visible guard before hiding the recovery UI. Otherwise a
  // very fast toolbar click could still save and close into the now-hidden tab
  // manager while chrome.storage is catching up.
  await chrome.storage.local.set({ [TAB_MANAGER_ENABLED_KEY]: next });
  tabManagerEnabled.value = next;

  if (!next) {
    searchQuery.value = '';
    showDashboard();
  }
}
