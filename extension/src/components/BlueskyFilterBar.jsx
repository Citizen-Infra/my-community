import { useState, useRef, useEffect } from 'preact/hooks';
import {
  blueskyFeedUri, setBlueskyFeedUri,
  blueskyTimeWindow, setBlueskyTimeWindow,
  blueskyShowReposts, setBlueskyShowReposts,
  blueskyWeightedSort, setBlueskyWeightedSort,
  blueskyAvailableFeeds, loadBlueskyFeed,
} from '../store/bluesky';

const WINDOWS = [
  { value: '24h', label: 'past 24h' },
  { value: '7d', label: 'past 7 days' },
  { value: '30d', label: 'past 30 days' },
];

// A labelled chip that opens a small menu of choices. Used for feed source and
// time window (2+ named options each).
function ChipSelect({ label, value, options, onSelect, title }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div
      class="bsky-chip-wrap"
      ref={ref}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
    >
      <button
        type="button"
        class="bsky-chip bsky-chip-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={title}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        <span>{label}</span>
        <svg class="bsky-chip-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div class="bsky-chip-menu" role="listbox">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              class={`bsky-chip-menu-item ${opt.value === value ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); onSelect(opt.value); setOpen(false); }}
            >
              <span class="bsky-chip-check" aria-hidden="true">{opt.value === value ? '✓' : ''}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// A chip that flips between two states in place. Filled when the richer option
// is on (reposts shown / weighted engagement), muted otherwise. The label always
// names the current state.
function ChipToggle({ label, active, onClick, title }) {
  return (
    <button
      type="button"
      class={`bsky-chip bsky-chip-toggle ${active ? 'on' : 'off'}`}
      aria-pressed={active}
      title={title}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

// The active-rule summary at the top of the Network feed: reads left to right as
// "Showing <source> · <window> · <reposts> · <sort>", each segment adjustable
// inline. Applying any change re-fetches immediately (loadBlueskyFeed is cache
// aware, so a no-op change costs nothing).
export function BlueskyFilterBar() {
  const feeds = blueskyAvailableFeeds.value;
  const uri = blueskyFeedUri.value;
  const win = blueskyTimeWindow.value;
  const showReposts = blueskyShowReposts.value;
  const weighted = blueskyWeightedSort.value;

  const currentFeed = feeds.find((f) => f.uri === uri);
  const feedLabel = currentFeed ? currentFeed.name : 'Following';

  const applyFeed = (v) => { setBlueskyFeedUri(v); loadBlueskyFeed(); };
  const applyWindow = (v) => { setBlueskyTimeWindow(v); loadBlueskyFeed(); };
  const toggleReposts = () => { setBlueskyShowReposts(!showReposts); loadBlueskyFeed(); };
  const toggleSort = () => { setBlueskyWeightedSort(!weighted); loadBlueskyFeed(); };

  return (
    <div class="bsky-filters" role="group" aria-label="Feed filters">
      <span class="bsky-filters-lead">Showing</span>

      {feeds.length > 1 ? (
        <ChipSelect
          label={feedLabel}
          value={uri}
          options={feeds.map((f) => ({
            value: f.uri,
            label: f.type === 'list' ? `List: ${f.name}` : f.name,
          }))}
          onSelect={applyFeed}
          title="Feed source"
        />
      ) : (
        <span class="bsky-chip bsky-chip-static">Following</span>
      )}

      <ChipSelect
        label={WINDOWS.find((w) => w.value === win)?.label || 'past 24h'}
        value={win}
        options={WINDOWS}
        onSelect={applyWindow}
        title="Time window"
      />

      <ChipToggle
        label={showReposts ? 'reposts on' : 'reposts off'}
        active={showReposts}
        onClick={toggleReposts}
        title={showReposts ? 'Hide reposts' : 'Show reposts'}
      />

      <ChipToggle
        label={weighted ? 'top by engagement' : 'top by likes'}
        active={weighted}
        onClick={toggleSort}
        title={weighted ? 'Sort by likes instead' : 'Sort by weighted engagement instead'}
      />
    </div>
  );
}
