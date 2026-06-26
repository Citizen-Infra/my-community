/**
 * Parse a Toby JSON export or Tab Hoarder export.
 * Toby format: { lists: [{ title, cards: [{ title, url }] }] }
 * Tab Hoarder format: { collections: [...], tabs: [...] }
 */
export function parseTobyExport(data) {
  // Tab Hoarder own format — preserve original timestamps so a restore/re-import
  // keeps each tab's real "date added" instead of stamping the import time.
  if (data.collections && data.tabs) {
    return data.collections.map((col) => ({
      name: col.name,
      isArchive: col.isArchive || false,
      color: col.color || null,
      createdAt: col.createdAt,
      updatedAt: col.updatedAt,
      tabs: data.tabs
        .filter((t) => t.collectionId === col.id)
        .map((t) => ({ title: t.title, url: t.url, createdAt: t.createdAt })),
    }));
  }

  // Toby format
  if (data.lists && Array.isArray(data.lists)) {
    return data.lists.map((list) => ({
      name: list.title || 'Untitled',
      tabs: (list.cards || []).map((card) => ({
        title: card.title || card.url,
        url: card.url,
      })),
    }));
  }

  throw new Error('Unrecognized format. Expected Toby or Tab Hoarder JSON.');
}
