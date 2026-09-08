import { signal, computed } from '@preact/signals';
import {
  DEFAULT_DASHBOARD_ORDER,
  moveDashboardTab,
  normalizeDashboardOrder,
  reorderDashboardTab,
} from '../lib/dashboard-order';
import { AUTO_PREVIEW_DEPTH, normalizePreviewDepth } from '../lib/dashboard-preview-depth';

function storedJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

const stored = storedJson('mc_visible_tabs', {});
export const visibleTabs = signal({
  network: stored.network ?? true,
  digest: stored.digest ?? true,
  participation: stored.participation ?? true,
  communityInput: stored.communityInput ?? true,
});

export const tabOrder = signal(normalizeDashboardOrder(
  storedJson('mc_dashboard_tab_order', DEFAULT_DASHBOARD_ORDER)
));

const storedPreviewDepths = storedJson('mc_dashboard_preview_depths', {});
export const previewDepths = signal(Object.fromEntries(
  DEFAULT_DASHBOARD_ORDER.map((tab) => [tab, normalizePreviewDepth(storedPreviewDepths[tab])])
));

// Jam is a global "now listening" strip (below the TopBar, every screen), not a
// dashboard tab — so it gets its own visibility flag, kept out of visibleTabs.
const storedJam = localStorage.getItem('mc_jam_visible');
export const jamVisible = signal(storedJam === null ? true : storedJam === 'true');

export function setJamVisible(visible) {
  jamVisible.value = visible;
  localStorage.setItem('mc_jam_visible', String(visible));
}

export const activeTab = signal(localStorage.getItem('mc_active_tab') || 'digest');
export const dashboardMode = signal('overview');

export function setActiveTab(tab) {
  activeTab.value = tab;
  localStorage.setItem('mc_active_tab', tab);
}

export function openDashboardFeed(tab) {
  setActiveTab(tab);
  dashboardMode.value = 'feed';
}

export function showDashboardOverview() {
  dashboardMode.value = 'overview';
}

function saveTabOrder(next) {
  tabOrder.value = next;
  localStorage.setItem('mc_dashboard_tab_order', JSON.stringify(next));
}

export function reorderTab(movedTab, targetTab) {
  saveTabOrder(reorderDashboardTab(tabOrder.value, movedTab, targetTab, availableTabs.value));
}

export function moveTab(tab, delta) {
  saveTabOrder(moveDashboardTab(tabOrder.value, tab, delta, availableTabs.value));
}

export function resetTabOrder() {
  saveTabOrder([...DEFAULT_DASHBOARD_ORDER]);
}

export function setPreviewDepth(tab, value) {
  if (!DEFAULT_DASHBOARD_ORDER.includes(tab)) return;
  const next = { ...previewDepths.value, [tab]: normalizePreviewDepth(value) };
  previewDepths.value = next;
  localStorage.setItem('mc_dashboard_preview_depths', JSON.stringify(next));
}

export function resetPreviewDepths() {
  const next = Object.fromEntries(DEFAULT_DASHBOARD_ORDER.map((tab) => [tab, AUTO_PREVIEW_DEPTH]));
  previewDepths.value = next;
  localStorage.setItem('mc_dashboard_preview_depths', JSON.stringify(next));
}

export function setTabVisible(tab, visible) {
  const next = { ...visibleTabs.value, [tab]: visible };
  visibleTabs.value = next;
  localStorage.setItem('mc_visible_tabs', JSON.stringify(next));
  if (!visible && activeTab.value === tab) {
    const first = tabOrder.value.find((key) => next[key]);
    if (first) setActiveTab(first);
    else showDashboardOverview();
  }
}

export const availableTabs = computed(() =>
  tabOrder.value.filter((key) => visibleTabs.value[key])
);
