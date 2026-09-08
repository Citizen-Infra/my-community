import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  availableTabs,
  dashboardCustomizing,
  moveTab,
  openDashboardFeed,
  previewDepths,
  reorderTab,
  resetPreviewDepths,
  resetTabOrder,
  setPreviewDepth,
} from '../store/panels';
import {
  digestError,
  digestLinks,
  digestLoaded,
  digestLoading,
} from '../store/digest';
import {
  activeSessions,
  openSessions,
  sessionsError,
  sessionsLoaded,
  sessionsLoading,
  upcomingSessions,
} from '../store/sessions';
import {
  blueskyError,
  blueskyAvailableFeeds,
  blueskyFeedUri,
  blueskyLoaded,
  blueskyLoading,
  blueskyShowReposts,
  blueskyTimeWindow,
  blueskyVisiblePosts,
  blueskyWeightedSort,
} from '../store/bluesky';
import { isConnected } from '../store/auth';
import {
  callProposals,
  decisionProposals,
  proposalsError,
  proposalsLoading,
  retryProposals,
} from '../store/proposals';
import {
  wikiError,
  wikiItems,
  wikiLoading,
  retryWikiQueue,
} from '../store/knowledge';
import { caSignedIn } from '../store/caAuth';
import { allCommunities, selectedCommunityIds } from '../store/communities';
import { communityInputStatus, mergeCommunityInputRows } from '../lib/community-input-order';
import { communityScope, networkPostMeta, networkScope } from '../lib/dashboard-preview-meta';
import {
  AUTO_PREVIEW_DEPTH,
  MAX_PREVIEW_DEPTH,
  fitPreviewDepth,
  previewRowDensity,
} from '../lib/dashboard-preview-depth';
import '../styles/dashboard-overview.css';

export const DASHBOARD_FEED_LABELS = {
  network: 'Network',
  digest: 'Digest',
  participation: 'Participation',
  communityInput: 'Community Input',
};

function safeHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function communityName(id) {
  if (!id) return '';
  return allCommunities.value.find((community) => community.id === id)?.name || id;
}

function blueskyPostUrl(post) {
  const rkey = post.uri?.split('/').pop();
  return post.author?.handle && rkey
    ? `https://bsky.app/profile/${post.author.handle}/post/${rkey}`
    : '';
}

function callProposalAnchor(proposal) {
  return `call-${proposal.community_id}-${proposal.id}`;
}

function communityInputAnchor(kind, item) {
  return `${kind}-${item.community_id}-${item.id}`;
}

function sessionUrl(session) {
  if (session.session_state === 'open' && session.session_join_url) return session.session_join_url;
  if (session.session_state === 'ready' && session.session_results_url) return session.session_results_url;
  if (session.source === 'session' && session.harmonica_session_id) {
    return `https://harmonica.chat/session/${session.harmonica_session_id}`;
  }
  return session.url || '';
}

function participationProvenance(item) {
  const details = [communityName(item.community_id || item.community)];
  if (item.starts_at) {
    details.push(new Date(item.starts_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }));
  }
  if (item.location) details.push(item.location);
  return details.filter(Boolean).join(' · ');
}

function selectedCommunityScope() {
  return communityScope(selectedCommunityIds.value, allCommunities.value);
}

function previewState(tab) {
  if (tab === 'digest') {
    const links = digestLinks.value;
    if (digestLoading.value && links.length === 0) return { state: 'loading', message: 'Gathering this week’s links…' };
    if (digestError.value && links.length === 0) return { state: 'error', message: 'The digest could not refresh. Open it to try again.' };
    if (!digestLoaded.value && links.length === 0) return { state: 'idle', message: 'Open the digest to gather this week’s links.' };
    if (links.length === 0) return { state: 'empty', message: 'No recent links from your communities.' };
    return {
      meta: selectedCommunityScope(),
      items: links.map((link, index) => ({
        key: `${link.community_id || ''}-${link.id || link.url}-${index}`,
        title: link.og_title || link.title || link.url,
        context: link.og_description || link.description || '',
        provenance: safeHost(link.url),
        href: link.url,
      })),
    };
  }

  if (tab === 'network') {
    if (!isConnected.value) return { state: 'signed-out', message: 'Connect Bluesky to see what your network is discussing.' };
    const posts = blueskyVisiblePosts.value;
    if (blueskyLoading.value && posts.length === 0) return { state: 'loading', message: 'Listening to your network…' };
    if (blueskyError.value && posts.length === 0) return { state: 'error', message: 'Network posts could not refresh. Open Network to try again.' };
    if (!blueskyLoaded.value && posts.length === 0) return { state: 'idle', message: 'Open Network to load popular posts from people you follow.' };
    if (posts.length === 0) return { state: 'empty', message: 'No posts in the current time window.' };
    return {
      meta: networkScope({
        feedUri: blueskyFeedUri.value,
        availableFeeds: blueskyAvailableFeeds.value,
        timeWindow: blueskyTimeWindow.value,
        showReposts: blueskyShowReposts.value,
        weightedSort: blueskyWeightedSort.value,
      }),
      items: posts.map((post) => ({
        key: post.uri,
        title: post.text || 'Shared a post',
        provenance: networkPostMeta(post),
        href: blueskyPostUrl(post),
      })),
    };
  }

  if (tab === 'participation') {
    const current = [
      ...activeSessions.value,
      ...openSessions.value,
      ...callProposals.value.filter((proposal) => !proposal.outcome && proposal.status === 'open').map((proposal) => ({
        ...proposal,
        title: proposal.title || proposal.question || 'Proposed community call',
        previewStatus: 'Proposed call',
        previewAnchor: callProposalAnchor(proposal),
      })),
      ...upcomingSessions.value,
    ];
    if (sessionsLoading.value && current.length === 0) return { state: 'loading', message: 'Finding ways to take part…' };
    if (sessionsError.value && current.length === 0) return { state: 'error', message: 'Participation opportunities could not refresh.' };
    if (!sessionsLoaded.value && current.length === 0) return { state: 'idle', message: 'Open Participation to find sessions and events.' };
    if (current.length === 0) return { state: 'empty', message: 'No open or upcoming sessions right now.' };
    return {
      meta: selectedCommunityScope(),
      items: current.map((item) => ({
        key: `${item.source || item.kind || 'participation'}-${item.community_id || item.community || ''}-${item.id}`,
        title: item.title,
        context: item.description || item.body || '',
        status: item.previewStatus || (item.status === 'active' ? 'Happening now' : item.status === 'open' ? 'Open to join' : 'Coming up'),
        provenance: participationProvenance(item),
        href: item.previewAnchor ? '' : sessionUrl(item),
        anchor: item.previewAnchor,
      })),
    };
  }

  if (!caSignedIn.value) {
    return { state: 'signed-out', message: 'Sign in to see decisions and sources awaiting community input.' };
  }

  const items = mergeCommunityInputRows(decisionProposals.value, wikiItems.value).map((row) =>
    row.kind === 'decision'
      ? {
          key: `decision-${row.p.community_id}-${row.p.id}`,
          title: row.p.title || row.p.question || 'Community decision',
          context: row.p.body || '',
          status: communityInputStatus(row.tier),
          anchor: communityInputAnchor('decision', row.p),
        }
      : {
          key: `knowledge-${row.k.community_id}-${row.k.id}`,
          title: row.k.title || row.k.url || 'Suggested source',
          context: row.k.summary || '',
          status: communityInputStatus(row.tier),
          anchor: communityInputAnchor('knowledge', row.k),
        }
  );
  if ((proposalsLoading.value || wikiLoading.value) && items.length === 0) return { state: 'loading', message: 'Checking what needs your voice…' };
  if ((proposalsError.value || wikiError.value) && items.length === 0) return { state: 'error', message: 'Community input could not refresh.' };
  if (items.length === 0) return { state: 'empty', message: 'Nothing needs your input right now.' };
  return {
    meta: selectedCommunityScope(),
    items,
  };
}

function ArrowIcon({ direction }) {
  const path = direction === 'left' ? 'M19 12H5m6-6-6 6 6 6' : 'M5 12h14m-6-6 6 6-6 6';
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function MoveIcon({ direction }) {
  const path = direction === 'up' ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6';
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

function tileAction(label, preview) {
  if (preview.state === 'signed-out') return label === 'Network' ? 'Connect Bluesky' : 'Sign in';
  if (preview.state === 'error') return 'Open to retry';
  if (preview.state === 'idle') return 'Load this feed';
  return `View ${label}`;
}

function usePreviewLayout(containerRef, itemCount, layoutKey) {
  const [layout, setLayout] = useState({
    autoCount: Math.min(itemCount, 3),
    availableHeight: 0,
  });

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || itemCount === 0) {
      setLayout({ autoCount: 0, availableHeight: node?.clientHeight || 0 });
      return undefined;
    }

    const update = () => setLayout({
      autoCount: fitPreviewDepth(node.clientHeight, itemCount),
      availableHeight: node.clientHeight,
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [itemCount, layoutKey]);

  return layout;
}

function openAnchoredItem(tab, anchor) {
  openDashboardFeed(tab);
  globalThis.setTimeout(() => {
    document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
  }, 0);
}

function PreviewRow({ item, tab, customizing }) {
  const content = (
    <>
      <strong>{item.title}</strong>
      {item.context && <span class="dashboard-preview-row-context">{item.context}</span>}
      {(item.status || item.provenance) && (
        <span class="dashboard-preview-row-meta">
          {item.status && <span class={item.status === 'Needs your response' ? 'needs-action' : ''}>{item.status}</span>}
          {item.status && item.provenance && <span aria-hidden="true"> · </span>}
          {item.provenance && <span>{item.provenance}</span>}
        </span>
      )}
    </>
  );

  if (customizing) return <span class="dashboard-preview-row is-static">{content}</span>;
  if (item.href) {
    return (
      <a class="dashboard-preview-row" href={item.href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      class="dashboard-preview-row"
      onClick={() => item.anchor ? openAnchoredItem(tab, item.anchor) : openDashboardFeed(tab)}
    >
      {content}
    </button>
  );
}

function TileHeading({ label, preview, customizing, index, count, onMove, onOpen, tab }) {
  return (
    <div class="dashboard-tile-heading">
      {customizing ? (
        <div class="dashboard-tile-heading-copy">
          <span class="dashboard-tile-title" role="heading" aria-level="3">{label}</span>
          {preview.meta && <span class="dashboard-tile-meta">{preview.meta}</span>}
        </div>
      ) : (
        <button type="button" class="dashboard-tile-heading-open" onClick={onOpen}>
          <span class="dashboard-tile-title" role="heading" aria-level="3">{label}</span>
          {preview.meta && <span class="dashboard-tile-meta">{preview.meta}</span>}
        </button>
      )}
      {customizing && (
        <div class="dashboard-tile-order-controls" aria-label={`Move ${label}`}>
          <span class="dashboard-drag-handle" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="8" cy="7" r="1.5" /><circle cx="16" cy="7" r="1.5" />
              <circle cx="8" cy="12" r="1.5" /><circle cx="16" cy="12" r="1.5" />
              <circle cx="8" cy="17" r="1.5" /><circle cx="16" cy="17" r="1.5" />
            </svg>
          </span>
          <button type="button" onClick={() => onMove(tab, -1)} disabled={index === 0} aria-label={`Move ${label} earlier`}>
            <MoveIcon direction="up" />
          </button>
          <button type="button" onClick={() => onMove(tab, 1)} disabled={index === count - 1} aria-label={`Move ${label} later`}>
            <MoveIcon direction="down" />
          </button>
        </div>
      )}
    </div>
  );
}

function TileBody({ preview, tab, customizing, depth, autoCount, availableHeight, containerRef, onOpen }) {
  const visibleCount = depth === AUTO_PREVIEW_DEPTH ? autoCount : depth;
  const visibleItems = preview.items?.slice(0, visibleCount) || [];
  const fixedOverflow = depth !== AUTO_PREVIEW_DEPTH
    && Math.min(depth, preview.items?.length || 0) > autoCount;
  const rowDensity = previewRowDensity(availableHeight, visibleItems.length);

  const stateContent = preview.state === 'loading' ? (
    <span class="dashboard-tile-loading" role="status">
      <span class="dashboard-tile-loading-copy">{preview.message}</span>
      <span class="dashboard-tile-loading-rule" aria-hidden="true" />
    </span>
  ) : (
    <span class={`dashboard-tile-message state-${preview.state}`}>{preview.message}</span>
  );

  return (
    <div ref={containerRef} class={`dashboard-tile-body ${fixedOverflow ? 'allows-scroll' : ''}`}>
      {preview.items ? (
        <div
          class={`dashboard-preview-list density-${rowDensity}`}
          style={{ '--preview-row-count': Math.max(visibleItems.length, 1) }}
        >
          {visibleItems.map((item) => <PreviewRow key={item.key} {...{ item, tab, customizing }} />)}
        </div>
      ) : customizing ? (
        <div class="dashboard-tile-state-open is-static">{stateContent}</div>
      ) : (
        <button type="button" class="dashboard-tile-state-open" onClick={onOpen}>{stateContent}</button>
      )}
    </div>
  );
}

function PreviewDepthControl({ label, depth, autoCount, onChange }) {
  return (
    <label class="dashboard-preview-depth">
      <span>Preview items</span>
      <select value={String(depth)} onInput={(event) => onChange(event.currentTarget.value)} aria-label={`${label} preview items`}>
        <option value={AUTO_PREVIEW_DEPTH}>Auto fit ({autoCount})</option>
        {Array.from({ length: MAX_PREVIEW_DEPTH }, (_, index) => index + 1).map((count) => (
          <option value={count} key={count}>{count}</option>
        ))}
      </select>
    </label>
  );
}

function DashboardTile({ tab, index, count, customizing, dragging, onDragStart, onDrop, onMove }) {
  const label = DASHBOARD_FEED_LABELS[tab];
  const preview = previewState(tab);
  const depth = previewDepths.value[tab] ?? AUTO_PREVIEW_DEPTH;
  const bodyRef = useRef(null);
  const { autoCount, availableHeight } = usePreviewLayout(bodyRef, preview.items?.length || 0, customizing);
  const handleOpen = () => {
    openDashboardFeed(tab);
    if (preview.state === 'error' && tab === 'communityInput') {
      retryProposals();
      retryWikiQueue();
    }
  };

  return (
    <article
      class={`dashboard-tile dashboard-tile-${tab} ${customizing ? 'is-customizing' : ''} ${dragging ? 'is-dragging' : ''}`}
      draggable={customizing}
      onDragStart={(event) => onDragStart(event, tab)}
      onDragEnd={() => onDragStart(null, null)}
      onDragOver={(event) => customizing && event.preventDefault()}
      onDrop={(event) => onDrop(event, tab)}
      onClick={(event) => {
        if (!customizing && !event.target.closest('a, button, select')) handleOpen();
      }}
    >
      <TileHeading {...{ label, preview, customizing, index, count, onMove, onOpen: handleOpen, tab }} />
      <TileBody {...{ preview, tab, customizing, depth, autoCount, availableHeight, containerRef: bodyRef, onOpen: handleOpen }} />
      {!customizing && (
        <button type="button" class="dashboard-tile-cta" onClick={handleOpen}>
          {tileAction(label, preview)}
          <ArrowIcon direction="right" />
        </button>
      )}
      {customizing && (
        <PreviewDepthControl
          {...{ label, depth, autoCount }}
          onChange={(value) => setPreviewDepth(tab, value)}
        />
      )}
    </article>
  );
}

export function DashboardOverview() {
  const [draggedTab, setDraggedTab] = useState(null);
  const [announcement, setAnnouncement] = useState({ id: 0, message: '' });
  const tabs = availableTabs.value;
  const customizing = dashboardCustomizing.value;

  const announce = (message) => {
    setAnnouncement((current) => ({ id: current.id + 1, message }));
  };

  const handleDragStart = (event, tab) => {
    if (event?.target?.closest('button, select, a')) {
      event.preventDefault();
      return;
    }
    setDraggedTab(tab);
    if (event?.dataTransfer && tab) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', tab);
    }
  };

  const handleDrop = (event, targetTab) => {
    event.preventDefault();
    const sourceTab = draggedTab || event.dataTransfer?.getData('text/plain');
    if (sourceTab && sourceTab !== targetTab) {
      reorderTab(sourceTab, targetTab);
      announce(`${DASHBOARD_FEED_LABELS[sourceTab]} reordered.`);
    }
    setDraggedTab(null);
  };

  const handleMove = (tab, delta) => {
    moveTab(tab, delta);
    announce(`${DASHBOARD_FEED_LABELS[tab]} moved ${delta < 0 ? 'earlier' : 'later'}.`);
  };

  const handleReset = () => {
    resetTabOrder();
    resetPreviewDepths();
    announce('Dashboard layout reset.');
  };

  if (tabs.length === 0) {
    return (
      <section class="dashboard-overview dashboard-overview-empty">
        <h2>Your community front page</h2>
        <p>Turn on at least one dashboard feed in Settings.</p>
      </section>
    );
  }

  return (
    <section class="dashboard-overview" aria-label="Dashboard overview">
      {customizing && (
        <div class="dashboard-customize-bar">
          <p>Drag feeds or use the arrows to reorder them. Choose how many preview items each tile shows.</p>
          <button type="button" class="dashboard-reset" onClick={handleReset}>Reset layout</button>
        </div>
      )}
      <div class="dashboard-tile-grid" data-count={tabs.length}>
        {tabs.map((tab, index) => (
          <DashboardTile
            key={tab}
            tab={tab}
            index={index}
            count={tabs.length}
            customizing={customizing}
            dragging={draggedTab === tab}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onMove={handleMove}
          />
        ))}
      </div>
      <p key={announcement.id} class="dashboard-order-announcement" role="status" aria-live="polite">{announcement.message}</p>
    </section>
  );
}
