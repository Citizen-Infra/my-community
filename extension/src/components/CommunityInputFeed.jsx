import { proposals, proposalsLoading } from '../store/proposals';
import { caSignedIn } from '../store/caAuth';
import { selectedCommunityIds } from '../store/communities';
import { DecisionCard } from './DecisionCard';
import { CommunityInputConnect } from './CommunityInputConnect';
import '../styles/community-input.css';

export function CommunityInputFeed() {
  if (!caSignedIn.value) {
    return <CommunityInputConnect />;
  }

  if (selectedCommunityIds.value.length === 0) {
    return <div class="feed-empty">Choose your communities in Settings to see what they're deciding.</div>;
  }

  if (proposalsLoading.value && proposals.value.length === 0) {
    return <div class="feed-empty">Loading decisions…</div>;
  }

  if (proposals.value.length === 0) {
    return (
      <div class="ci-empty">
        <p class="ci-empty-title">No open decisions right now</p>
        <p class="ci-empty-line">
          When your community posts one, you'll be able to agree or raise an objection here.
        </p>
      </div>
    );
  }

  return (
    <div class="ci-feed">
      <p class="ci-intro">
        What your communities are deciding. Silence counts as consent; raise an objection only
        if you can't live with it.
      </p>
      {proposals.value.map((p) => (
        <DecisionCard key={`${p.community_id}-${p.id}`} proposal={p} />
      ))}
    </div>
  );
}
