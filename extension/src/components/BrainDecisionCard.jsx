import { getCommunityColors } from '../lib/community-colors';
import { brainDecisionTier, communityInputStatus } from '../lib/community-input-order';
import { allCommunities } from '../store/communities';

const COMMUNITY_ID = 'philanthropic-xxi';

function formatDate(value) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  });
}

export function BrainDecisionCard({ decision }) {
  const colors = getCommunityColors(COMMUNITY_ID);
  const community = allCommunities.value.find((item) => item.id === COMMUNITY_ID);
  const status = communityInputStatus(brainDecisionTier(decision));

  return (
    <article
      class="decision-card brain-decision-card"
      style={{ '--community-border': colors.border, '--community-bg': colors.bg, '--community-text': colors.text }}
    >
      <div class="decision-card-accent" aria-hidden="true" />
      <a class="brain-decision-link" href={decision.href}>
        <span class="decision-card-head">
          <span class="decision-card-community">{community?.name || 'Philanthropic XXI'}</span>
          <span class="brain-decision-state">{status}</span>
        </span>
        <span class="decision-card-title" role="heading" aria-level="3">{decision.title}</span>
        <span class="brain-decision-meta">
          <span>{formatDate(decision.date)}</span>
          <span class="brain-decision-action">
            Read decision
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </span>
        </span>
      </a>
    </article>
  );
}
