import { getDB } from '../store/db';

export async function exportData(collectionId) {
  const db = getDB();
  let collections = await db.getAll('collections');
  let tabs = await db.getAll('tabs');

  if (collectionId) {
    collections = collections.filter((c) => c.id === collectionId);
    tabs = tabs.filter((t) => t.collectionId === collectionId);
  }

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    collections,
    tabs,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tab-hoarder-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
