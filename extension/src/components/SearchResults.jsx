import { searchQuery, searchResults } from '../store/search';
import { activeCollectionId } from '../store/collections';
import { TabCard } from './TabCard';
import { useDragAndDrop } from '../hooks/useDragAndDrop';

export function SearchResults() {
  const results = searchResults.value;
  const query = searchQuery.value;
  const { tabDrag } = useDragAndDrop();

  const totalTabs = results.reduce((sum, g) => sum + g.tabs.length, 0);

  return (
    <div class="search-results">
      <div class="search-results-header">
        {totalTabs} {totalTabs === 1 ? 'result' : 'results'} for "{query}"
      </div>
      {results.map((group) => (
        <div class="search-group" key={group.collection?.id}>
          <h3
            class="search-group-title"
            style={{ cursor: 'pointer' }}
            onClick={() => {
              if (group.collection) {
                activeCollectionId.value = group.collection.id;
                searchQuery.value = '';
              }
            }}
          >
            {group.collection?.name || 'Unknown collection'}
          </h3>
          <div class="tab-grid">
            {group.tabs.map((tab) => (
              <TabCard key={tab.id} tab={tab} tabDrag={tabDrag} />
            ))}
          </div>
        </div>
      ))}
      {results.length === 0 && (
        <div class="empty-state">
          <h2 class="empty-state-title">No results</h2>
          <p class="empty-state-text">
            No tabs match "{query}". Try a different search.
          </p>
        </div>
      )}
    </div>
  );
}
