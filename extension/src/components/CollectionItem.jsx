import { useState, useRef } from 'preact/hooks';
import { renameCollection, deleteCollection } from '../store/collections';
import { collectionSort } from '../store/sort';
import { ConfirmDialog } from './ConfirmDialog';

export function CollectionItem({ collection, count, active, onSelect, collectionDrag }) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [showDelete, setShowDelete] = useState(false);
  const itemRef = useRef(null);

  const handleRename = async () => {
    const name = editName.trim();
    if (name && name !== collection.name) {
      await renameCollection(collection.id, name);
    } else {
      setEditName(collection.name);
    }
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') {
      setEditName(collection.name);
      setEditing(false);
    }
  };

  const handleDelete = async () => {
    await deleteCollection(collection.id);
    setShowDelete(false);
  };

  return (
    <>
      <div
        ref={itemRef}
        class={`collection-item ${active ? 'active' : ''}`}
        onClick={onSelect}
        draggable={collectionSort.value === 'manual'}
        onDragStart={(e) => collectionDrag.onDragStart(e, collection.id)}
        onDragOver={(e) => collectionDrag.onDragOver(e, collection.id)}
        onDragLeave={(e) => collectionDrag.onDragLeave(e)}
        onDrop={(e) => collectionDrag.onDrop(e, collection.id)}
        onDragEnd={collectionDrag.onDragEnd}
      >
        <span class="collection-dot" />
        {editing ? (
          <input
            class="collection-name-input"
            value={editName}
            onInput={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleRename}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span class="collection-name">{collection.name}</span>
        )}
        <span class="collection-count">{count}</span>
        <div class="collection-actions">
          <button
            class="collection-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setEditName(collection.name);
              setEditing(true);
            }}
            title="Rename"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </button>
          <button
            class="collection-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowDelete(true);
            }}
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>
      {showDelete && (
        <ConfirmDialog
          title="Delete collection"
          message={`Delete "${collection.name}" and all its tabs? This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
