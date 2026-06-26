import { signal } from '@preact/signals';
import { reorderTabs, moveTab, allTabs } from '../store/tabs';
import { reorderCollections, collections, activeCollectionId } from '../store/collections';
import { collectionSort, tabSort } from '../store/sort';

const dragType = signal(null); // 'tab' | 'collection'
const dragId = signal(null);
const dragData = signal(null);

export function useDragAndDrop() {
  const tabDrag = {
    onDragStart(e, tab) {
      if (tabSort.value !== 'manual') { e.preventDefault(); return; }
      dragType.value = 'tab';
      dragId.value = tab.id;
      dragData.value = tab;
      e.dataTransfer.effectAllowed = 'move';
      e.target.classList.add('dragging');
    },

    onDragOver(e, targetTabId) {
      if (dragType.value !== 'tab') return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.add('drag-over');
    },

    onDragLeave(e) {
      e.currentTarget.classList.remove('drag-over');
    },

    onDrop(e, targetTab) {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      if (dragType.value !== 'tab' || !dragData.value) return;

      const sourceTab = dragData.value;
      if (sourceTab.id === targetTab.id) return;

      // Same collection: reorder
      if (sourceTab.collectionId === targetTab.collectionId) {
        const collectionTabs = allTabs.value
          .filter((t) => t.collectionId === targetTab.collectionId)
          .sort((a, b) => a.order - b.order);

        const ids = collectionTabs.map((t) => t.id);
        const fromIdx = ids.indexOf(sourceTab.id);
        const toIdx = ids.indexOf(targetTab.id);
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, sourceTab.id);
        reorderTabs(targetTab.collectionId, ids);
      } else {
        // Different collection: move
        moveTab(sourceTab.id, targetTab.collectionId, targetTab.order);
      }
    },

    onDragEnd(e) {
      e.target.classList.remove('dragging');
      dragType.value = null;
      dragId.value = null;
      dragData.value = null;
      document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    },
  };

  const collectionDrag = {
    onDragStart(e, collectionId) {
      if (collectionSort.value !== 'manual') { e.preventDefault(); return; }
      dragType.value = 'collection';
      dragId.value = collectionId;
      e.dataTransfer.effectAllowed = 'move';

      // Also handle drop of tabs onto collections in sidebar
      if (e.target.closest) {
        e.target.closest('.collection-item')?.classList.add('dragging');
      }
    },

    onDragOver(e, collectionId) {
      e.preventDefault();

      if (dragType.value === 'tab') {
        // Tab being dragged over a collection in sidebar
        e.currentTarget.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
      } else if (dragType.value === 'collection' && dragId.value !== collectionId) {
        e.currentTarget.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
      }
    },

    onDragLeave(e) {
      e.currentTarget.classList.remove('drag-over');
    },

    onDrop(e, targetCollectionId) {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');

      if (dragType.value === 'tab' && dragData.value) {
        // Move tab to this collection
        const existingTabs = allTabs.value.filter(
          (t) => t.collectionId === targetCollectionId
        );
        const maxOrder = existingTabs.reduce((max, t) => Math.max(max, t.order), -1);
        moveTab(dragData.value.id, targetCollectionId, maxOrder + 1);
        activeCollectionId.value = targetCollectionId;
      } else if (dragType.value === 'collection' && dragId.value !== targetCollectionId) {
        // Reorder collections (exclude archive)
        const ids = collections.value.filter((c) => !c.isArchive).map((c) => c.id);
        const fromIdx = ids.indexOf(dragId.value);
        const toIdx = ids.indexOf(targetCollectionId);
        if (fromIdx === -1 || toIdx === -1) return;
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, dragId.value);
        reorderCollections(ids);
      }
    },

    onDragEnd(e) {
      document.querySelectorAll('.dragging, .drag-over').forEach((el) => {
        el.classList.remove('dragging', 'drag-over');
      });
      dragType.value = null;
      dragId.value = null;
      dragData.value = null;
    },
  };

  return { tabDrag, collectionDrag };
}
