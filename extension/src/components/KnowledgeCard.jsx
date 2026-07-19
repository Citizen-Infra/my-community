import { useState } from 'preact/hooks';
import { castKnowledgeVote, isVotableKnowledge } from '../store/knowledge';
import { allCommunities } from '../store/communities';
import { subjectLabel } from '../store/handles';
import { getCommunityColors } from '../lib/community-colors';

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const CAST_LABEL = { agree: 'supported', pass: 'passed', disagree: 'opposed' };

// Positive end-states carry a badge; a candidate is still gathering support and
// shows its progress in the meta line instead.
const STATUS = {
  ready: { cls: 'decision-status--ready', label: 'Ready for the wiki' },
  approved: { cls: 'decision-status--added', label: 'In the wiki' },
  processed: { cls: 'decision-status--added', label: 'In the wiki' },
};

// A community knowledge source rising toward the wiki. Sibling of DecisionCard,
// sharing the card shell; the rule is promote-on-threshold (opt-in), so the
// affordance is Support / Pass / Oppose rather than the consent block.
export function KnowledgeCard({ item: k }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const colors = getCommunityColors(k.community_id);
  const community = allCommunities.value.find((c) => c.id === k.community_id);
  const communityName = community?.name || k.community_id;

  const votable = isVotableKnowledge(k.status);
  const status = STATUS[k.status];
  const title = k.title || hostOf(k.url);
  const agree = k.agree || 0;
  const disagree = k.disagree || 0;
  const pass = k.pass || 0;

  async function vote(value) {
    setError(null);
    setBusy(true);
    try {
      await castKnowledgeVote(k.community_id, k.id, value);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <article
      class="decision-card knowledge-card"
      style={{ '--community-border': colors.border, '--community-bg': colors.bg, '--community-text': colors.text }}
    >
      <div class="decision-card-accent" aria-hidden="true" />
      <div class="decision-card-body">
        <div class="decision-card-head">
          <span class="decision-card-community">{communityName}</span>
          {status && <span class={`decision-status ${status.cls}`}>{status.label}</span>}
        </div>

        <h3 class="decision-card-title">
          <a class="knowledge-link" href={k.url} target="_blank" rel="noopener noreferrer">{title}</a>
        </h3>
        {k.summary && <p class="decision-card-text">{k.summary}</p>}
        <p class="decision-card-source">{hostOf(k.url)}</p>

        <p class="decision-card-meta">
          Wiki source · suggested by {subjectLabel(k.submitted_by, 'a member')}
          {k.status === 'candidate' && <> · <span class="knowledge-progress">gathering support</span></>}
        </p>

        {votable && (
          <div class="decision-actions">
            <button
              class={`decision-vote decision-vote--agree ${k.my_vote === 'agree' ? 'is-selected' : ''}`}
              onClick={() => vote('agree')}
              disabled={busy}
              aria-pressed={k.my_vote === 'agree'}
            >
              Support
            </button>
            <button
              class={`decision-vote decision-vote--pass ${k.my_vote === 'pass' ? 'is-selected' : ''}`}
              onClick={() => vote('pass')}
              disabled={busy}
              aria-pressed={k.my_vote === 'pass'}
            >
              Pass
            </button>
            <button
              class={`decision-vote decision-vote--oppose ${k.my_vote === 'disagree' ? 'is-selected' : ''}`}
              onClick={() => vote('disagree')}
              disabled={busy}
              aria-pressed={k.my_vote === 'disagree'}
            >
              Oppose
            </button>
          </div>
        )}

        {votable && k.my_vote && (
          <p class="decision-changevote">You can change your vote while it's gathering support.</p>
        )}

        <div class="decision-card-foot">
          <span class="decision-tally">
            {agree} support · {disagree} oppose · {pass} pass
          </span>
          {k.my_vote && CAST_LABEL[k.my_vote] && (
            <span class="decision-myvote">You {CAST_LABEL[k.my_vote]}</span>
          )}
        </div>

        {error && <p class="decision-card-error">{error}</p>}
      </div>
    </article>
  );
}
