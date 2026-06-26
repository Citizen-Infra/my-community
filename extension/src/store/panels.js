import { signal, computed } from '@preact/signals';

const stored = JSON.parse(localStorage.getItem('mc_visible_tabs') || '{}');
export const visibleTabs = signal({
  network: stored.network ?? true,
  digest: stored.digest ?? true,
  participation: stored.participation ?? true,
});

// Jam is a global "now listening" strip (below the TopBar, every screen), not a
// dashboard tab — so it gets its own visibility flag, kept out of visibleTabs.
const storedJam = localStorage.getItem('mc_jam_visible');
export const jamVisible = signal(storedJam === null ? true : storedJam === 'true');

export function setJamVisible(visible) {
  jamVisible.value = visible;
  localStorage.setItem('mc_jam_visible', String(visible));
}

export const activeTab = signal(localStorage.getItem('mc_active_tab') || 'digest');

export function setActiveTab(tab) {
  activeTab.value = tab;
  localStorage.setItem('mc_active_tab', tab);
}

export function setTabVisible(tab, visible) {
  const next = { ...visibleTabs.value, [tab]: visible };
  visibleTabs.value = next;
  localStorage.setItem('mc_visible_tabs', JSON.stringify(next));
  if (!visible && activeTab.value === tab) {
    const first = Object.entries(next).find(([, v]) => v);
    if (first) setActiveTab(first[0]);
  }
}

export const availableTabs = computed(() =>
  Object.entries(visibleTabs.value)
    .filter(([, visible]) => visible)
    .map(([key]) => key)
);
