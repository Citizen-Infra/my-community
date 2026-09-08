export const AUTO_PREVIEW_DEPTH = 'auto';
export const MAX_PREVIEW_DEPTH = 20;
export const PREVIEW_ROW_HEIGHT = 49;

export function previewRowDensity(availableHeight, visibleCount) {
  if (visibleCount <= 0) return 'compact';
  const rowHeight = Math.max(0, availableHeight) / visibleCount;
  if (rowHeight >= 160) return 'expansive';
  if (rowHeight >= 96) return 'comfortable';
  return 'compact';
}

export function normalizePreviewDepth(value) {
  if (value === AUTO_PREVIEW_DEPTH) return value;
  const count = Number(value);
  if (!Number.isInteger(count)) return AUTO_PREVIEW_DEPTH;
  return Math.max(1, Math.min(MAX_PREVIEW_DEPTH, count));
}

export function fitPreviewDepth(availableHeight, itemCount) {
  if (itemCount <= 0) return 0;
  const fitted = Math.max(1, Math.floor(Math.max(0, availableHeight) / PREVIEW_ROW_HEIGHT));
  return Math.min(itemCount, fitted);
}
