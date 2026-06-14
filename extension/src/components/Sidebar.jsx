import { useState } from 'preact/hooks';
import {
  activeCollectionId,
  archiveCollection,
  regularCollections,
  createCollection,
} from '../store/collections';
import { allTabs } from '../store/tabs';
import { collectionSort, setCollectionSort } from '../store/sort';
import { CollectionItem } from './CollectionItem';
import { SortMenu } from './SortMenu';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

export function Sidebar() {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const { collectionDrag } = useDragAndDrop();

  const handleAdd = async () => {
    const name = newName.trim();
    if (name) {
      await createCollection(name);
      setNewName('');
    }
    setAdding(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') {
      setNewName('');
      setAdding(false);
    }
  };

  return (
    <div class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Tab Hoarder</span>
        <SortMenu
          value={collectionSort.value}
          onChange={setCollectionSort}
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'name', label: 'Name' },
            { value: 'updated', label: 'Date updated' },
          ]}
        />
      </div>
      <div class="sidebar-list">
        {regularCollections.value.map((col) => {
          const count = allTabs.value.filter(
            (t) => t.collectionId === col.id
          ).length;
          return (
            <CollectionItem
              key={col.id}
              collection={col}
              count={count}
              active={col.id === activeCollectionId.value}
              onSelect={() => { activeCollectionId.value = col.id; }}
              collectionDrag={collectionDrag}
            />
          );
        })}
      </div>
      <div class="sidebar-footer">
        {archiveCollection.value && (() => {
          const archive = archiveCollection.value;
          const archiveCount = allTabs.value.filter(
            (t) => t.collectionId === archive.id
          ).length;
          return (
            <div
              class={`collection-item archive-item ${archive.id === activeCollectionId.value ? 'active' : ''}`}
              onClick={() => { activeCollectionId.value = archive.id; }}
              onDragOver={(e) => collectionDrag.onDragOver(e, archive.id)}
              onDragLeave={(e) => collectionDrag.onDragLeave(e)}
              onDrop={(e) => collectionDrag.onDrop(e, archive.id)}
            >
              <svg class="archive-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="5" rx="1" />
                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                <path d="M10 12h4" />
              </svg>
              <span class="collection-name">Archive</span>
              <span class="collection-count">{archiveCount}</span>
            </div>
          );
        })()}
        {adding ? (
          <div style={{ padding: '0 8px' }}>
            <input
              class="collection-name-input"
              style={{ width: '100%' }}
              value={newName}
              onInput={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleAdd}
              placeholder="Collection name"
              autoFocus
            />
          </div>
        ) : (
          <button
            class="add-collection-btn"
            onClick={() => setAdding(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New collection
          </button>
        )}
      </div>
    </div>
  );
}
