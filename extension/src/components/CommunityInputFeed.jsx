// decisionProposals, not proposals: the same endpoint also carries call-proposals,
// which have no tallies and no my_vote and belong in Participation (#100).
import { decisionProposals, proposalsLoading, proposalsError, retryProposals } from '../store/proposals';
import { wikiItems, wikiLoading, wikiError, retryWikiQueue } from '../store/knowledge';
import { caSignedIn } from '../store/caAuth';
import { selectedCommunityIds } from '../store/communities';
import { DecisionCard } from './DecisionCard';
import { KnowledgeCard } from './KnowledgeCard';
import { CommunityInputConnect } from './CommunityInputConnect';
import { FeedError } from './FeedError';
import { mergeCommunityInputRows } from '../lib/community-input-order';
import '../styles/community-input.css';

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

  const decisions = decisionProposals.value;
  const knowledge = wikiItems.value;
  const total = decisions.length + knowledge.length;

  if ((proposalsLoading.value || wikiLoading.value) && total === 0) {
    return <div class="feed-empty">Loading decisions and sources…</div>;
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

  const rows = mergeCommunityInputRows(decisions, knowledge);

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
