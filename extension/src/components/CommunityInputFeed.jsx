// decisionProposals, not proposals: the same endpoint also carries call-proposals,
// which have no tallies and no my_vote and belong in Participation (#100).
import { decisionProposals, proposalsLoading, proposalsError, retryProposals } from '../store/proposals';
import { wikiItems, wikiLoading, wikiError, retryWikiQueue } from '../store/knowledge';
import {
  brainDecisions,
  brainDecisionsError,
  brainDecisionsLoading,
  retryBrainDecisions,
} from '../store/brain-decisions';
import { caSignedIn } from '../store/caAuth';
import { selectedCommunityIds } from '../store/communities';
import { DecisionCard } from './DecisionCard';
import { KnowledgeCard } from './KnowledgeCard';
import { BrainDecisionCard } from './BrainDecisionCard';
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

function sourceFailureMessage() {
  const sources = [];
  if (proposalsError.value) sources.push('consent decisions');
  if (wikiError.value) sources.push('suggested sources');
  if (brainDecisionsError.value) sources.push('decision records');
  if (sources.length === 1) return `${sources[0][0].toUpperCase()}${sources[0].slice(1)} could not refresh.`;
  return `Some Community Input sources could not refresh: ${sources.join(', ')}.`;
}

export function CommunityInputFeed() {
  if (!caSignedIn.value) {
    return <CommunityInputConnect />;
  }

  if (selectedCommunityIds.value.length === 0) {
    return <div class="feed-empty">Choose your communities in Settings to see what they're weighing in on.</div>;
  }

  const decisions = decisionProposals.value;
  const knowledge = wikiItems.value;
  const brain = brainDecisions.value;
  const total = decisions.length + knowledge.length + brain.length;
  const loading = proposalsLoading.value || wikiLoading.value || brainDecisionsLoading.value;
  const failed = proposalsError.value || wikiError.value || brainDecisionsError.value;
  const retryAll = () => {
    retryProposals();
    retryWikiQueue();
    retryBrainDecisions();
  };

  if (loading && total === 0) {
    return <div class="feed-empty">Loading decisions and sources…</div>;
  }

  if (failed && total === 0) {
    return <FeedError onRetry={retryAll} message={sourceFailureMessage()} />;
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

  const rows = mergeCommunityInputRows(decisions, knowledge, brain);

  const renderRow = (row) => {
    if (row.kind === 'decision') {
      return <DecisionCard key={`d-${row.p.community_id}-${row.p.id}`} proposal={row.p} />;
    }
    if (row.kind === 'brain-decision') {
      return <BrainDecisionCard key={`b-${row.d.path}`} decision={row.d} />;
    }
    return <KnowledgeCard key={`k-${row.k.community_id}-${row.k.id}`} item={row.k} />;
  };

  return (
    <div class="ci-feed">
      {failed && (
        <div class="ci-source-warning" role="status">
          <span>{sourceFailureMessage()}</span>
          <button type="button" onClick={retryAll}>Try again</button>
        </div>
      )}
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
