import { useState, useEffect } from 'preact/hooks';
import { createCollection } from '../store/collections';
import { addTabs, allTabs } from '../store/tabs';
import { getFaviconUrl } from '../lib/favicon';

function flattenBookmarkTree(nodes, depth = 0, result = []) {
  for (const node of nodes) {
    if (!node.children) continue;
    const bookmarks = node.children.filter((c) => c.url);
    if (bookmarks.length > 0) {
      result.push({
        id: node.id,
        title: node.title || 'Untitled',
        depth,
        bookmarks: bookmarks.map((b) => ({ title: b.title, url: b.url })),
        checked: false,
      });
    }
    const subfolders = node.children.filter((c) => c.children);
    if (subfolders.length > 0) {
      flattenBookmarkTree(subfolders, depth + 1, result);
    }
  }
  return result;
}

export function BookmarkImportModal({ onClose }) {
  const [folders, setFolders] = useState([]);
  const [status, setStatus] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      if (!chrome?.bookmarks) {
        setError('Bookmarks API not available. Load the extension in Chrome to use this feature.');
        return;
      }
      chrome.bookmarks.getTree((tree) => {
        const flat = flattenBookmarkTree(tree);
        setFolders(flat);
      });
    } catch {
      setError('Failed to load bookmarks.');
    }
  }, []);

  const toggleFolder = (id) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, checked: !f.checked } : f))
    );
  };

  const checkedCount = folders.filter((f) => f.checked).length;

  const handleImport = async () => {
    const selected = folders.filter((f) => f.checked);
    if (selected.length === 0) return;

    setImporting(true);
    try {
      const existingUrls = new Set(allTabs.value.map((t) => t.url));
      let importedCollections = 0;
      let importedTabs = 0;
      let skippedTabs = 0;

      for (const folder of selected) {
        const newBookmarks = folder.bookmarks.filter((b) => !existingUrls.has(b.url));
        skippedTabs += folder.bookmarks.length - newBookmarks.length;

        if (newBookmarks.length === 0) continue;

        const col = await createCollection(folder.title);
        const tabsData = newBookmarks.map((b) => ({
          title: b.title,
          url: b.url,
          favicon: getFaviconUrl(b.url),
        }));
        await addTabs(col.id, tabsData);

        for (const b of newBookmarks) existingUrls.add(b.url);
        importedCollections++;
        importedTabs += newBookmarks.length;
      }

      const parts = [`Imported ${importedCollections} collection${importedCollections !== 1 ? 's' : ''} with ${importedTabs} tab${importedTabs !== 1 ? 's' : ''}.`];
      if (skippedTabs > 0) parts.push(`${skippedTabs} duplicate${skippedTabs !== 1 ? 's' : ''} skipped.`);
      if (importedCollections === 0) parts[0] = 'No new tabs to import — all URLs already exist.';

      setStatus({ type: 'success', message: parts.join(' ') });
    } catch (err) {
      setStatus({ type: 'error', message: `Import failed: ${err.message}` });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()}>
        <h2 class="modal-title">Import bookmarks</h2>
        <p class="modal-text">
          Select folders to import as collections. Duplicate URLs are skipped.
        </p>

        {error ? (
          <p class="import-status error">{error}</p>
        ) : folders.length === 0 ? (
          <p class="import-status">No bookmark folders with URLs found.</p>
        ) : (
          <div class="bookmark-folder-list">
            {folders.map((f) => (
              <div
                key={f.id}
                class="bookmark-folder-item"
                style={{ paddingLeft: `${f.depth * 20 + 8}px` }}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={f.checked}
                    onChange={() => toggleFolder(f.id)}
                    disabled={importing}
                  />
                  <span>{f.title}</span>
                  <span class="bookmark-folder-count">{f.bookmarks.length}</span>
                </label>
              </div>
            ))}
          </div>
        )}

        {status && (
          <p class={`import-status ${status.type}`}>{status.message}</p>
        )}

        <div class="modal-actions" style={{ marginTop: '16px' }}>
          <button class="modal-btn cancel" onClick={onClose}>
            {status?.type === 'success' ? 'Done' : 'Cancel'}
          </button>
          {!error && !status && (
            <button
              class="modal-btn confirm"
              onClick={handleImport}
              disabled={checkedCount === 0 || importing}
            >
              {importing ? 'Importing...' : `Import ${checkedCount} folder${checkedCount !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
