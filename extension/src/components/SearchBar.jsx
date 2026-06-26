import { useEffect, useRef } from 'preact/hooks';
import { searchQuery } from '../store/search';

export function SearchBar() {
  const inputRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && searchQuery.value) {
        searchQuery.value = '';
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div class="search-bar">
      <svg class="search-bar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search tabs..."
        value={searchQuery.value}
        onInput={(e) => (searchQuery.value = e.target.value)}
      />
      {!searchQuery.value && <span class="search-bar-shortcut">/</span>}
    </div>
  );
}
