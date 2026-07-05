import { useState, useRef, useEffect } from 'preact/hooks';
import { removeTab, moveTab, allTabs, archiveTab } from '../store/tabs';
import { collections, archiveCollection, touchCollection } from '../store/collections';
import { tabSort } from '../store/sort';
import { getFaviconUrl, getDomain } from '../lib/favicon';

export function TabCard({ tab, tabDrag }) {
  const favicon = tab.favicon || getFaviconUrl(tab.url);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    const close = () => setShowMenu(false);
    document.addEventListener('mousedown', handleClick);
    // Capture so we also catch scrolling of the .main-content scroller (scroll doesn't bubble).
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [showMenu]);

  // Anchor the menu to the button's on-screen rect with position: fixed so it escapes
  // the .main-content overflow clip. Flip upward when there isn't room below.
  const toggleMenu = (e) => {
    e.stopPropagation();
    if (showMenu) {
      setShowMenu(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const margin = 6;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const pos = { right: window.innerWidth - rect.right };
    if (openUp) {
      pos.bottom = window.innerHeight - rect.top + margin;
      pos.maxHeight = spaceAbove - margin * 2;
    } else {
      pos.top = rect.bottom + margin;
      pos.maxHeight = spaceBelow - margin * 2;
    }
    setMenuPos(pos);
    setShowMenu(true);
  };

  const handleClick = () => {
    chrome.tabs.create({ url: tab.url });
  };

  const handleRemove = async (e) => {
    e.stopPropagation();
    await removeTab(tab.id);
  };

  const handleMove = async (targetCollectionId) => {
    const targetTabs = allTabs.value.filter((t) => t.collectionId === targetCollectionId);
    const maxOrder = targetTabs.reduce((max, t) => Math.max(max, t.order), -1);
    await moveTab(tab.id, targetCollectionId, maxOrder + 1);
    await touchCollection(targetCollectionId);
    setShowMenu(false);
  };

  const isInArchive = archiveCollection.value && tab.collectionId === archiveCollection.value.id;
  const otherCollections = collections.value
    .filter((c) => c.id !== tab.collectionId && !c.isArchive)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const handleArchive = async (e) => {
    e.stopPropagation();
    await archiveTab(tab.id);
  };

  return (
    <div
      class="tab-card"
      onClick={handleClick}
      draggable={tabSort.value === 'manual'}
      onDragStart={(e) => tabDrag.onDragStart(e, tab)}
      onDragOver={(e) => tabDrag.onDragOver(e, tab.id)}
      onDragLeave={(e) => tabDrag.onDragLeave(e)}
      onDrop={(e) => tabDrag.onDrop(e, tab)}
      onDragEnd={tabDrag.onDragEnd}
    >
      <img
        class="tab-favicon"
        src={favicon}
        alt=""
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
      <div class="tab-info">
        <div class="tab-title" title={tab.title}>{tab.title}</div>
        <div class="tab-domain" title={tab.url}>{getDomain(tab.url)}</div>
      </div>
      <div class={`tab-actions ${showMenu ? 'menu-open' : ''}`} ref={menuRef}>
        {otherCollections.length > 0 && (
          <button
            class="tab-action-btn"
            onClick={toggleMenu}
            title="Move to collection"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {!isInArchive && (
          <button class="tab-action-btn" onClick={handleArchive} title="Archive tab">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="5" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
          </button>
        )}
        <button class="tab-action-btn" onClick={handleRemove} title="Remove tab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {showMenu && menuPos && (
          <div
            class="tab-move-menu"
            style={{
              top: menuPos.top != null ? `${menuPos.top}px` : 'auto',
              bottom: menuPos.bottom != null ? `${menuPos.bottom}px` : 'auto',
              right: `${menuPos.right}px`,
              maxHeight: `${menuPos.maxHeight}px`,
            }}
          >
            <div class="tab-move-menu-title">Move to</div>
            {otherCollections.map((col) => (
              <button
                key={col.id}
                class="tab-move-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMove(col.id);
                }}
              >
                {col.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
