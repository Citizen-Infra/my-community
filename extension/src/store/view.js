import { signal } from '@preact/signals';
import { activeCollectionId } from './collections';

// Which surface the main area shows: 'dashboard' | <collectionId>
export const activeView = signal('dashboard');

export function showDashboard() {
  activeView.value = 'dashboard';
}

export function showCollection(id) {
  // MainContent reads the active collection from the collections store,
  // so set both in lockstep.
  activeCollectionId.value = id;
  activeView.value = id;
}
