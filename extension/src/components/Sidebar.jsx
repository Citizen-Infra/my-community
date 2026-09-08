import { useState } from 'preact/hooks';
import {
  archiveCollection,
  regularCollections,
  createCollection,
} from '../store/collections';
import { allTabs } from '../store/tabs';
import { collectionSort, setCollectionSort } from '../store/sort';
import { activeView, showDashboard, showCollection } from '../store/view';
import {
  availableTabs,
  dashboardCustomizing,
  showDashboardOverview,
  stopDashboardCustomization,
  toggleDashboardCustomization,
} from '../store/panels';
import { CollectionItem } from './CollectionItem';
import { SortMenu } from './SortMenu';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

export function Sidebar() {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const { collectionDrag } = useDragAndDrop();

  const handleShowDashboard = () => {
    showDashboard();
    showDashboardOverview();
  };

  const handleCustomizeDashboard = () => {
    showDashboard();
    toggleDashboardCustomization();
  };

  const handleShowCollection = (id) => {
    stopDashboardCustomization();
    showCollection(id);
  };

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
      <nav class="sidebar-pinned-nav">
        <div class="sidebar-pinned-row">
          <button
            class={`sidebar-pinned ${activeView.value === 'dashboard' ? 'active' : ''}`}
            onClick={handleShowDashboard}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            class={`sidebar-dashboard-customize ${dashboardCustomizing.value ? 'active' : ''}`}
            onClick={handleCustomizeDashboard}
            disabled={availableTabs.value.length === 0}
            aria-label="Customize dashboard"
            aria-pressed={dashboardCustomizing.value}
            title="Customize dashboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="4" y1="7" x2="20" y2="7" />
              <circle cx="9" cy="7" r="2" fill="var(--bg-sidebar)" />
              <line x1="4" y1="17" x2="20" y2="17" />
              <circle cx="15" cy="17" r="2" fill="var(--bg-sidebar)" />
            </svg>
          </button>
        </div>
      </nav>
      <div class="sidebar-header">
        <div class="sidebar-title-wrap">
          <span class="sidebar-title">Collections</span>
          <span
            class="sidebar-title-lock"
            title="Only on this device. Not visible to your community."
            aria-label="Saved tabs are private to this device"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
        </div>
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
              active={activeView.value === col.id}
              onSelect={() => handleShowCollection(col.id)}
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
              class={`collection-item archive-item ${activeView.value === archive.id ? 'active' : ''}`}
              onClick={() => handleShowCollection(archive.id)}
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
