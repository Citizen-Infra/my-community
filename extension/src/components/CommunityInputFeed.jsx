import { proposals, proposalsLoading, proposalsError, retryProposals } from '../store/proposals';
import { wikiItems, wikiLoading, wikiError, retryWikiQueue, isVotableKnowledge } from '../store/knowledge';
import { caSignedIn } from '../store/caAuth';
import { selectedCommunityIds } from '../store/communities';
import { DecisionCard } from './DecisionCard';
import { KnowledgeCard } from './KnowledgeCard';
import { CommunityInputConnect } from './CommunityInputConnect';
import { FeedError } from './FeedError';
import '../styles/community-input.css';

// Priority tier for the merged feed: items needing your response first, then other
// still-open items, then resolved ones. Each source list is already urgency-sorted,
// so a stable sort by (tier, kind) preserves that order within each group.
function decisionTier(p) {
  const open = new Date(p.closes_at).getTime() > Date.now();
  if (open && !p.my_vote) return 0;
  if (open) return 1;
  return 2;
}
function knowledgeTier(k) {
  const votable = isVotableKnowledge(k.status);
  if (votable && !k.my_vote) return 0;
  if (votable) return 1;
  return 2;
}

// One list across both kinds. Within a tier, time-boxed decisions sit ahead of
// deadline-free sources.
function mergedFeed(decisions, knowledge) {
  const rows = [
    ...decisions.map((p) => ({ kind: 'decision', tier: decisionTier(p), p })),
    ...knowledge.map((k) => ({ kind: 'knowledge', tier: knowledgeTier(k), k })),
  ];
  rows.sort((a, b) => a.tier - b.tier || (a.kind === b.kind ? 0 : a.kind === 'decision' ? -1 : 1));
  return rows;
}

// The three feed sections, mirroring the Participation group dividers. Tiers come
// from decisionTier / knowledgeTier; a section with no items does not render.
const SECTIONS = [
  { tier: 0, label: 'Needs your response', status: 'active' },
  { tier: 1, label: 'In progress', status: 'upcoming' },
  { tier: 2, label: 'Resolved', status: 'done' },
];

export function CommunityInputFeed() {
  if (!caSignedIn.value) {
    return <CommunityInputConnect />;
  }

  if (selectedCommunityIds.value.length === 0) {
    return <div class="feed-empty">Choose your communities in Settings to see what they're weighing in on.</div>;
  }

  const decisions = proposals.value;
  const knowledge = wikiItems.value;
  const total = decisions.length + knowledge.length;

  if ((proposalsLoading.value || wikiLoading.value) && total === 0) {
    return <div class="feed-empty">Loading what your communities are weighing in on…</div>;
  }

  if ((proposalsError.value || wikiError.value) && total === 0) {
    return <FeedError onRetry={() => { retryProposals(); retryWikiQueue(); }} />;
  }

  if (total === 0) {
    return (
      <div class="ci-empty">
        <p class="ci-empty-title">Nothing to weigh in on right now</p>
        <p class="ci-empty-line">
          When your community posts a decision or suggests a source for the wiki, it shows up here.
        </p>
      </div>
    );
  }

  const rows = mergedFeed(decisions, knowledge);

  const renderRow = (row) =>
    row.kind === 'decision' ? (
      <DecisionCard key={`d-${row.p.community_id}-${row.p.id}`} proposal={row.p} />
    ) : (
      <KnowledgeCard key={`k-${row.k.community_id}-${row.k.id}`} item={row.k} />
    );

  return (
    <div class="ci-feed">
      {SECTIONS.map((section) => {
        const items = rows.filter((r) => r.tier === section.tier);
        if (items.length === 0) return null;
        return (
          <div class="ci-group" key={section.tier}>
            <h3 class={`ci-group-title status-${section.status}`}>{section.label}</h3>
            {items.map(renderRow)}
          </div>
        );
      })}
    </div>
  );
}
