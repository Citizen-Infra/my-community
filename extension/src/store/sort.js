import { signal } from '@preact/signals';

const COLLECTION_SORT_KEY = 'tab-hoarder-collection-sort';
const TAB_SORT_KEY = 'tab-hoarder-tab-sort';

export const collectionSort = signal(localStorage.getItem(COLLECTION_SORT_KEY) || 'manual');
export const tabSort = signal(localStorage.getItem(TAB_SORT_KEY) || 'manual');

export function setCollectionSort(mode) {
  collectionSort.value = mode;
  localStorage.setItem(COLLECTION_SORT_KEY, mode);
}

export function setTabSort(mode) {
  tabSort.value = mode;
  localStorage.setItem(TAB_SORT_KEY, mode);
}
