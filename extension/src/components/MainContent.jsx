import { useState } from 'preact/hooks';
import { activeCollection, renameCollection } from '../store/collections';
import { activeTabs } from '../store/tabs';
import { tabSort, setTabSort } from '../store/sort';
import { TabCard } from './TabCard';
import { EmptyState } from './EmptyState';
import { SortMenu } from './SortMenu';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

export function MainContent() {
  const collection = activeCollection.value;
  const tabs = activeTabs.value;
  const { tabDrag } = useDragAndDrop();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  if (!collection) {
    return (
      <div class="main-content">
        <EmptyState
          title="No collections yet"
          text="Create your first collection from the sidebar to start saving tabs."
        />
      </div>
    );
  }

  const handleRename = async () => {
    const name = editName.trim();
    if (name && name !== collection.name) {
      await renameCollection(collection.id, name);
    }
    setEditing(false);
  };

  return (
    <div class="main-content">
      <div class="collection-header">
        <div class="collection-title-row">
          {editing ? (
            <input
              class="collection-title-input"
              value={editName}
              onInput={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={handleRename}
              autoFocus
            />
          ) : (
            <>
              <h1 class="collection-title">{collection.name}</h1>
              {!collection.isArchive && (
                <button
                  class="collection-title-edit"
                  onClick={() => {
                    setEditName(collection.name);
                    setEditing(true);
                  }}
                  title="Rename collection"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                  </svg>
                </button>
              )}
              <SortMenu
                value={tabSort.value}
                onChange={setTabSort}
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'name', label: 'Name' },
                  { value: 'created', label: 'Date added' },
                ]}
              />
            </>
          )}
        </div>
        <p class="collection-meta">
          {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
        </p>
      </div>
      {tabs.length === 0 ? (
        <EmptyState
          title="This collection is empty"
          text='Save open tabs with the "Save tab" button or click the toolbar icon.'
        />
      ) : (
        <div class="tab-grid">
          {tabs.map((tab) => (
            <TabCard
              key={tab.id}
              tab={tab}
              tabDrag={tabDrag}
            />
          ))}
        </div>
      )}
    </div>
  );
}
