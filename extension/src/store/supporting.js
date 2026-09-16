import { signal } from '@preact/signals';
import { SUPPORTING_TILE_KEYS } from '../lib/dashboard-preferences';

function storedKeys() {
  try {
    const parsed = JSON.parse(localStorage.getItem('mc_supporting_tiles') || 'null');
    if (Array.isArray(parsed)) return parsed.filter((key) => SUPPORTING_TILE_KEYS.includes(key));
  } catch {}
  return [...SUPPORTING_TILE_KEYS];
}

export const visibleSupportingTileKeys = signal(storedKeys());

export function setSupportingTileVisible(key, visible) {
  const next = visible
    ? [...new Set([...visibleSupportingTileKeys.value, key])]
    : visibleSupportingTileKeys.value.filter((item) => item !== key);
  visibleSupportingTileKeys.value = next;
  localStorage.setItem('mc_supporting_tiles', JSON.stringify(next));
}

export function replaceSupportingTileKeys(keys) {
  visibleSupportingTileKeys.value = keys.filter((key) => SUPPORTING_TILE_KEYS.includes(key));
  localStorage.setItem('mc_supporting_tiles', JSON.stringify(visibleSupportingTileKeys.value));
}
