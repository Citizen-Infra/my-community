import { useState, useRef, useEffect } from 'preact/hooks';
import {
  blueskyFeedUri, setBlueskyFeedUri,
  blueskyTimeWindow, setBlueskyTimeWindow,
  blueskyShowReposts, setBlueskyShowReposts,
  blueskyWeightedSort, setBlueskyWeightedSort,
  blueskyAvailableFeeds, loadBlueskyFeed,
} from '../store/bluesky';

const WINDOWS = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const SORT_OPTIONS = [
  { value: false, label: 'Most liked' },
  { value: true, label: 'Most discussed' },
];

// A labelled chip that opens a menu of feed choices, grouped by kind. `groups` is
// an array of { label, options: [{ value, label }] }; group headers render only
// when more than one group is present (a lone group stays a flat list).
function ChipSelect({ label, value, groups, onSelect, title }) {
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

  const showHeaders = groups.length > 1;

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
          {groups.map((group) => (
            <div class="bsky-chip-group" role="group" aria-label={group.label} key={group.label}>
              {showHeaders && <div class="bsky-chip-group-label" aria-hidden="true">{group.label}</div>}
              {group.options.map((opt) => (
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
          ))}
        </div>
      )}
    </div>
  );
}

// A segmented control: one of a small fixed set, all options shown at once.
// Used for time window (3) and sort (2).
function Segmented({ label, options, value, onChange }) {
  return (
    <div class="bsky-segment" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          class={`bsky-segment-btn ${opt.value === value ? 'active' : ''}`}
          aria-pressed={opt.value === value}
          onClick={() => { if (opt.value !== value) onChange(opt.value); }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// The active-rule summary at the top of the Network feed, left to right:
// source (grouped dropdown), then, for chronological feeds only, time window +
// sort (segmented), then reposts (toggle). Algorithmic feed generators rank
// their own way, so the window and sort controls are hidden for them. Any change
// re-fetches immediately (loadBlueskyFeed is cache aware, so a no-op costs nothing).
export function BlueskyFilterBar() {
  const feeds = blueskyAvailableFeeds.value;
  const uri = blueskyFeedUri.value;
  const win = blueskyTimeWindow.value;
  const showReposts = blueskyShowReposts.value;
  const weighted = blueskyWeightedSort.value;

  const currentFeed = feeds.find((f) => f.uri === uri);
  const feedLabel = currentFeed ? currentFeed.name : 'Following';

  // Mirror the store's rule: a feed generator is algorithmic, the Following
  // timeline and Lists are chronological. Window + sort apply only to the latter.
  const algorithmic = currentFeed
    ? currentFeed.type === 'feed'
    : (uri !== 'timeline' && !uri.includes('app.bsky.graph.list'));

  // Group the feed picker: chronological sources (Following + Lists) above
  // algorithmic feed generators. Empty groups drop out.
  const toOption = (f) => ({
    value: f.uri,
    label: f.type === 'list' ? `List: ${f.name}` : f.name,
  });
  const groups = [
    { label: 'Chronological', options: feeds.filter((f) => f.type === 'timeline' || f.type === 'list').map(toOption) },
    { label: 'Algorithmic', options: feeds.filter((f) => f.type === 'feed').map(toOption) },
  ].filter((g) => g.options.length > 0);

  const applyFeed = (v) => { setBlueskyFeedUri(v); loadBlueskyFeed(); };
  const applyWindow = (v) => { setBlueskyTimeWindow(v); loadBlueskyFeed(); };
  const applySort = (v) => { setBlueskyWeightedSort(v); loadBlueskyFeed(); };
  const onRepostsChange = (e) => { setBlueskyShowReposts(e.target.checked); loadBlueskyFeed(); };

  return (
    <div class="bsky-filters" role="group" aria-label="Feed filters">
      {feeds.length > 1 ? (
        <ChipSelect
          label={feedLabel}
          value={uri}
          groups={groups}
          onSelect={applyFeed}
          title="Feed source"
        />
      ) : (
        <span class="bsky-chip bsky-chip-static">Following</span>
      )}

      {!algorithmic && (
        <Segmented label="Time window" options={WINDOWS} value={win} onChange={applyWindow} />
      )}

      {!algorithmic && (
        <Segmented label="Sort" options={SORT_OPTIONS} value={weighted} onChange={applySort} />
      )}

      <label class="bsky-toggle">
        <span>Reposts</span>
        <span class="bsky-toggle-switch">
          <input type="checkbox" checked={showReposts} onChange={onRepostsChange} />
          <span class="bsky-toggle-track" aria-hidden="true" />
        </span>
      </label>
    </div>
  );
}
