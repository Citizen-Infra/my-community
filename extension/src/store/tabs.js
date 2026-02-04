import { signal, computed } from '@preact/signals';

const stored = JSON.parse(localStorage.getItem('mc_visible_tabs') || '{}');
export const visibleTabs = signal({
  network: stored.network ?? true,
  digest: stored.digest ?? true,
  participation: stored.participation ?? true,
});

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
