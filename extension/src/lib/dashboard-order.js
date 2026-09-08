export const DEFAULT_DASHBOARD_ORDER = [
  'network',
  'digest',
  'participation',
  'communityInput',
];

export function normalizeDashboardOrder(value) {
  const supplied = Array.isArray(value) ? value : [];
  const known = supplied.filter(
    (tab, index) => DEFAULT_DASHBOARD_ORDER.includes(tab) && supplied.indexOf(tab) === index
  );
  return [
    ...known,
    ...DEFAULT_DASHBOARD_ORDER.filter((tab) => !known.includes(tab)),
  ];
}

export function reorderDashboardTab(order, movedTab, targetTab) {
  const normalized = normalizeDashboardOrder(order);
  const from = normalized.indexOf(movedTab);
  const to = normalized.indexOf(targetTab);
  if (from < 0 || to < 0 || from === to) return normalized;

  const next = [...normalized];
  next.splice(from, 1);
  next.splice(to, 0, movedTab);
  return next;
}

export function moveDashboardTab(order, tab, delta) {
  const normalized = normalizeDashboardOrder(order);
  const from = normalized.indexOf(tab);
  const to = Math.max(0, Math.min(normalized.length - 1, from + delta));
  if (from < 0 || from === to) return normalized;

  const next = [...normalized];
  next.splice(from, 1);
  next.splice(to, 0, tab);
  return next;
}
