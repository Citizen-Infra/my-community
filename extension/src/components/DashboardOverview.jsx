import { useState } from 'preact/hooks';
import {
  availableTabs,
  moveTab,
  openDashboardFeed,
  reorderTab,
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
  blueskyLoaded,
  blueskyLoading,
  blueskyVisiblePosts,
} from '../store/bluesky';
import { isConnected } from '../store/auth';
import {
  callProposals,
  decisionProposals,
  openUnvotedCount,
  proposalsError,
  proposalsLoading,
} from '../store/proposals';
import {
  openUnvotedKnowledgeCount,
  wikiError,
  wikiItems,
  wikiLoading,
} from '../store/knowledge';
import { caSignedIn } from '../store/caAuth';
import { mergeCommunityInputRows } from '../lib/community-input-order';
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

function previewState(tab) {
  if (tab === 'digest') {
    const links = digestLinks.value;
    if (digestLoading.value && links.length === 0) return { state: 'loading', message: 'Gathering this week’s links…' };
    if (digestError.value && links.length === 0) return { state: 'error', message: 'The digest could not refresh. Open it to try again.' };
    if (!digestLoaded.value && links.length === 0) return { state: 'idle', message: 'Open the digest to gather this week’s links.' };
    if (links.length === 0) return { state: 'empty', message: 'No recent links from your communities.' };
    return {
      meta: `${links.length} recent ${links.length === 1 ? 'link' : 'links'}`,
      items: links.slice(0, 3).map((link) => ({
        title: link.og_title || link.title || link.url,
        detail: safeHost(link.url),
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
      meta: `${posts.length} ${posts.length === 1 ? 'post' : 'posts'} in view`,
      items: posts.slice(0, 3).map((post) => ({
        title: post.author.displayName || `@${post.author.handle}`,
        detail: post.text || 'Shared a post',
      })),
    };
  }

  if (tab === 'participation') {
    const current = [
      ...callProposals.value.filter((proposal) => !proposal.outcome && proposal.status === 'open').map((proposal) => ({
        ...proposal,
        title: proposal.title || proposal.question || 'Proposed community call',
        previewDetail: 'Call proposal',
      })),
      ...openSessions.value,
      ...activeSessions.value,
      ...upcomingSessions.value,
    ];
    if (sessionsLoading.value && current.length === 0) return { state: 'loading', message: 'Finding ways to take part…' };
    if (sessionsError.value && current.length === 0) return { state: 'error', message: 'Participation opportunities could not refresh.' };
    if (!sessionsLoaded.value && current.length === 0) return { state: 'idle', message: 'Open Participation to find sessions and events.' };
    if (current.length === 0) return { state: 'empty', message: 'No open or upcoming sessions right now.' };
    return {
      meta: `${current.length} open or upcoming`,
      items: current.slice(0, 3).map((session) => ({
        title: session.title,
        detail: session.previewDetail || (session.status === 'active' ? 'Happening now' : session.status === 'open' ? 'Open to join' : 'Coming up'),
      })),
    };
  }

  if (!caSignedIn.value) {
    return { state: 'signed-out', message: 'Sign in to see decisions and sources awaiting community input.' };
  }

  const pending = openUnvotedCount.value + openUnvotedKnowledgeCount.value;
  const items = mergeCommunityInputRows(decisionProposals.value, wikiItems.value).map((row) =>
    row.kind === 'decision'
      ? {
          title: row.p.title || row.p.question || 'Community decision',
          detail: row.p.my_vote ? 'Response recorded' : 'Decision',
        }
      : {
          title: row.k.title || row.k.url || 'Suggested source',
          detail: row.k.my_vote ? 'Response recorded' : 'Wiki suggestion',
        }
  );
  if ((proposalsLoading.value || wikiLoading.value) && items.length === 0) return { state: 'loading', message: 'Checking what needs your voice…' };
  if ((proposalsError.value || wikiError.value) && items.length === 0) return { state: 'error', message: 'Community input could not refresh.' };
  if (items.length === 0) return { state: 'empty', message: 'Nothing needs your input right now.' };
  return {
    meta: pending > 0 ? `${pending} awaiting your response` : `${items.length} recent ${items.length === 1 ? 'item' : 'items'}`,
    pending,
    items: items.slice(0, 3),
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

function DashboardTile({ tab, index, count, customizing, dragging, onDragStart, onDrop, onMove }) {
  const label = DASHBOARD_FEED_LABELS[tab];
  const preview = previewState(tab);

  return (
    <article
      class={`dashboard-tile dashboard-tile-${tab} ${customizing ? 'is-customizing' : ''} ${dragging ? 'is-dragging' : ''}`}
      draggable={customizing}
      onDragStart={(event) => onDragStart(event, tab)}
      onDragEnd={() => onDragStart(null, null)}
      onDragOver={(event) => customizing && event.preventDefault()}
      onDrop={(event) => onDrop(event, tab)}
    >
      <div class="dashboard-tile-heading">
        <div>
          <h3>{label}</h3>
          {preview.meta && <p>{preview.meta}</p>}
        </div>
        {customizing && (
          <div class="dashboard-tile-order-controls" aria-label={`Move ${label}`}>
            <span class="dashboard-drag-handle" title={`Drag ${label} to rearrange`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="8" cy="7" r="1.5" /><circle cx="16" cy="7" r="1.5" />
                <circle cx="8" cy="12" r="1.5" /><circle cx="16" cy="12" r="1.5" />
                <circle cx="8" cy="17" r="1.5" /><circle cx="16" cy="17" r="1.5" />
              </svg>
            </span>
            <button type="button" onClick={() => onMove(tab, -1)} disabled={index === 0} aria-label={`Move ${label} earlier`}>
              <ArrowIcon direction="left" />
            </button>
            <button type="button" onClick={() => onMove(tab, 1)} disabled={index === count - 1} aria-label={`Move ${label} later`}>
              <ArrowIcon direction="right" />
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        class="dashboard-tile-open"
        onClick={() => openDashboardFeed(tab)}
        disabled={customizing}
        aria-label={`Open ${label} feed`}
      >
        {preview.items ? (
          <span class="dashboard-tile-items">
            {preview.items.map((item, itemIndex) => (
              <span class="dashboard-tile-item" key={`${item.title}-${itemIndex}`}>
                <strong>{item.title}</strong>
                {item.detail && <span>{item.detail}</span>}
              </span>
            ))}
          </span>
        ) : preview.state === 'loading' ? (
          <span class="dashboard-tile-loading" aria-label={preview.message}>
            <span /><span />
          </span>
        ) : (
          <span class={`dashboard-tile-message state-${preview.state}`}>{preview.message}</span>
        )}
        {!customizing && (
          <span class="dashboard-tile-cta">
            Open {label}
            <ArrowIcon direction="right" />
          </span>
        )}
      </button>
    </article>
  );
}

export function DashboardOverview() {
  const [customizing, setCustomizing] = useState(false);
  const [draggedTab, setDraggedTab] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const tabs = availableTabs.value;

  const handleDragStart = (event, tab) => {
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
      setAnnouncement(`${DASHBOARD_FEED_LABELS[sourceTab]} reordered.`);
    }
    setDraggedTab(null);
  };

  const handleMove = (tab, delta) => {
    moveTab(tab, delta);
    setAnnouncement(`${DASHBOARD_FEED_LABELS[tab]} moved ${delta < 0 ? 'earlier' : 'later'}.`);
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
    <section class="dashboard-overview" aria-labelledby="dashboard-overview-title">
      <header class="dashboard-overview-header">
        <div>
          <h2 id="dashboard-overview-title">Today in your communities</h2>
          <p>{customizing ? 'Drag feeds or use the arrow controls to set their order.' : 'A glance across the conversations, invitations, and choices around you.'}</p>
        </div>
        <button
          type="button"
          class={`dashboard-customize ${customizing ? 'active' : ''}`}
          aria-pressed={customizing}
          onClick={() => setCustomizing((value) => !value)}
        >
          {customizing ? 'Done' : 'Customize'}
        </button>
      </header>

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
      <p class="dashboard-order-announcement" role="status" aria-live="polite">{announcement}</p>
    </section>
  );
}
