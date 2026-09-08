import { useState } from 'preact/hooks';
import {
  availableTabs,
  moveTab,
  openDashboardFeed,
  reorderTab,
  resetTabOrder,
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
  retryProposals,
} from '../store/proposals';
import {
  openUnvotedKnowledgeCount,
  wikiError,
  wikiItems,
  wikiLoading,
  retryWikiQueue,
} from '../store/knowledge';
import { caSignedIn } from '../store/caAuth';
import { allCommunities } from '../store/communities';
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

function communityName(id) {
  if (!id) return '';
  return allCommunities.value.find((community) => community.id === id)?.name || id;
}

function previewState(tab) {
  if (tab === 'digest') {
    const links = digestLinks.value;
    if (digestLoading.value && links.length === 0) return { state: 'loading', message: 'Gathering this week’s links…' };
    if (digestError.value && links.length === 0) return { state: 'error', message: 'The digest could not refresh. Open it to try again.' };
    if (!digestLoaded.value && links.length === 0) return { state: 'idle', message: 'Open the digest to gather this week’s links.' };
    if (links.length === 0) return { state: 'empty', message: 'No recent links from your communities.' };
    const lead = links[0];
    return {
      meta: `${links.length} recent ${links.length === 1 ? 'link' : 'links'}`,
      lead: {
        title: lead.og_title || lead.title || lead.url,
        provenance: [communityName(lead.community_id), safeHost(lead.url)].filter(Boolean).join(' · '),
      },
    };
  }

  if (tab === 'network') {
    if (!isConnected.value) return { state: 'signed-out', message: 'Connect Bluesky to see what your network is discussing.' };
    const posts = blueskyVisiblePosts.value;
    if (blueskyLoading.value && posts.length === 0) return { state: 'loading', message: 'Listening to your network…' };
    if (blueskyError.value && posts.length === 0) return { state: 'error', message: 'Network posts could not refresh. Open Network to try again.' };
    if (!blueskyLoaded.value && posts.length === 0) return { state: 'idle', message: 'Open Network to load popular posts from people you follow.' };
    if (posts.length === 0) return { state: 'empty', message: 'No posts in the current time window.' };
    const lead = posts[0];
    return {
      meta: `${posts.length} ${posts.length === 1 ? 'post' : 'posts'} in view`,
      lead: {
        title: lead.text || 'Shared a post',
        provenance: lead.author.displayName
          ? `${lead.author.displayName} · @${lead.author.handle}`
          : `@${lead.author.handle}`,
      },
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
      })),
      ...upcomingSessions.value,
    ];
    if (sessionsLoading.value && current.length === 0) return { state: 'loading', message: 'Finding ways to take part…' };
    if (sessionsError.value && current.length === 0) return { state: 'error', message: 'Participation opportunities could not refresh.' };
    if (!sessionsLoaded.value && current.length === 0) return { state: 'idle', message: 'Open Participation to find sessions and events.' };
    if (current.length === 0) return { state: 'empty', message: 'No open or upcoming sessions right now.' };
    const lead = current[0];
    return {
      meta: `${current.length} ${current.length === 1 ? 'way' : 'ways'} to take part`,
      lead: {
        title: lead.title,
        status: lead.previewStatus || (lead.status === 'active' ? 'Happening now' : lead.status === 'open' ? 'Open to join' : 'Coming up'),
        provenance: communityName(lead.community_id || lead.community),
      },
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
          status: row.p.my_vote ? 'Response recorded' : 'Needs your response',
          provenance: communityName(row.p.community_id),
        }
      : {
          title: row.k.title || row.k.url || 'Suggested source',
          status: row.k.my_vote ? 'Response recorded' : 'Needs your response',
          provenance: communityName(row.k.community_id),
        }
  );
  if ((proposalsLoading.value || wikiLoading.value) && items.length === 0) return { state: 'loading', message: 'Checking what needs your voice…' };
  if ((proposalsError.value || wikiError.value) && items.length === 0) return { state: 'error', message: 'Community input could not refresh.' };
  if (items.length === 0) return { state: 'empty', message: 'Nothing needs your input right now.' };
  return {
    meta: pending > 0 ? `${pending} awaiting your response` : `${items.length} recent ${items.length === 1 ? 'item' : 'items'}`,
    pending,
    lead: items[0],
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

function TileContents({ label, preview, customizing, index, count, onMove, tab }) {
  return (
    <>
      <span class="dashboard-tile-heading">
        <span>
          <span class="dashboard-tile-title" role="heading" aria-level="3">{label}</span>
          {preview.meta && <span class={`dashboard-tile-meta ${preview.pending ? 'needs-action' : ''}`}>{preview.meta}</span>}
        </span>
        {customizing && (
          <span class="dashboard-tile-order-controls" aria-label={`Move ${label}`}>
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
          </span>
        )}
      </span>

      <span class="dashboard-tile-body">
        {preview.lead ? (
          <span class="dashboard-tile-lead">
            {preview.lead.status && (
              <span class={`dashboard-tile-status ${preview.lead.status === 'Needs your response' ? 'needs-action' : ''}`}>
                {preview.lead.status}
              </span>
            )}
            <strong>{preview.lead.title}</strong>
            {preview.lead.provenance && <span class="dashboard-tile-provenance">{preview.lead.provenance}</span>}
          </span>
        ) : preview.state === 'loading' ? (
          <span class="dashboard-tile-loading" role="status">
            <span class="dashboard-tile-loading-copy">{preview.message}</span>
            <span class="dashboard-tile-loading-rule" aria-hidden="true" />
          </span>
        ) : (
          <span class={`dashboard-tile-message state-${preview.state}`}>{preview.message}</span>
        )}
      </span>

      {!customizing && (
        <span class="dashboard-tile-cta">
          {tileAction(label, preview)}
          <ArrowIcon direction="right" />
        </span>
      )}
    </>
  );
}

function DashboardTile({ tab, index, count, customizing, dragging, onDragStart, onDrop, onMove }) {
  const label = DASHBOARD_FEED_LABELS[tab];
  const preview = previewState(tab);
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
    >
      {customizing ? (
        <div class="dashboard-tile-static">
          <TileContents {...{ label, preview, customizing, index, count, onMove, tab }} />
        </div>
      ) : (
        <button type="button" class="dashboard-tile-open" onClick={handleOpen}>
          <TileContents {...{ label, preview, customizing, index, count, onMove, tab }} />
        </button>
      )}
    </article>
  );
}

export function DashboardOverview() {
  const [customizing, setCustomizing] = useState(false);
  const [draggedTab, setDraggedTab] = useState(null);
  const [announcement, setAnnouncement] = useState({ id: 0, message: '' });
  const tabs = availableTabs.value;

  const announce = (message) => {
    setAnnouncement((current) => ({ id: current.id + 1, message }));
  };

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
    announce('Dashboard feed order reset.');
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
          {customizing && <p>Drag feeds or use the arrow controls to set their order.</p>}
        </div>
        <div class="dashboard-customize-actions">
          {customizing && <button type="button" class="dashboard-reset" onClick={handleReset}>Reset order</button>}
          <button
            type="button"
            class={`dashboard-customize ${customizing ? 'active' : ''}`}
            aria-pressed={customizing}
            onClick={() => setCustomizing((value) => !value)}
          >
            {customizing ? 'Done' : 'Customize'}
          </button>
        </div>
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
      <p key={announcement.id} class="dashboard-order-announcement" role="status" aria-live="polite">{announcement.message}</p>
    </section>
  );
}
