import { useState } from 'preact/hooks';
import { castVote } from '../store/proposals';
import { allCommunities } from '../store/communities';
import { getCommunityColors } from '../lib/community-colors';

// "closes in 2 days" / "closes in 4 hours" / "closes in about an hour".
function relTime(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return mins <= 1 ? 'in under a minute' : `in ${mins} minutes`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return hrs <= 1 ? 'in about an hour' : `in ${hrs} hours`;
  return `in ${Math.round(hrs / 24)} days`;
}

// The facilitator's subject is an email or a DID. Show a light, non-sensitive label:
// the local-part of an email, or a generic term for a DID (no raw address in the feed).
function proposerLabel(createdBy) {
  if (createdBy && createdBy.includes('@') && !createdBy.startsWith('did:')) {
    return createdBy.split('@')[0];
  }
  return 'a facilitator';
}

const CAST_LABEL = { agree: 'agreed', pass: 'passed', block: 'objected', disagree: 'disagreed' };

export function DecisionCard({ proposal: p }) {
  const [objectionOpen, setObjectionOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const colors = getCommunityColors(p.community_id);
  const community = allCommunities.value.find((c) => c.id === p.community_id);
  const communityName = community?.name || p.community_id;

  const ms = new Date(p.closes_at).getTime() - Date.now();
  const windowOpen = ms > 0;
  const t = p.tallies || { agree: 0, disagree: 0, pass: 0, block: 0 };

  async function vote(value, reasonText) {
    setError(null);
    setBusy(true);
    try {
      await castVote(p.community_id, p.id, value, reasonText);
      setObjectionOpen(false);
      setReason('');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  function submitObjection(e) {
    e.preventDefault();
    if (!reason.trim()) return;
    vote('block', reason.trim());
  }

  return (
    <article
      class="decision-card"
      style={{ '--community-border': colors.border, '--community-bg': colors.bg, '--community-text': colors.text }}
    >
      <div class="decision-card-accent" aria-hidden="true" />
      <div class="decision-card-body">
        <div class="decision-card-head">
          <span class="decision-card-community">{communityName}</span>
          {p.status === 'ratified' && <span class="decision-status decision-status--ratified">Ratified</span>}
          {p.status === 'objected' && <span class="decision-status decision-status--objected">Objected</span>}
        </div>

        <h3 class="decision-card-title">{p.title}</h3>
        {p.body && <p class="decision-card-text">{p.body}</p>}

        <p class="decision-card-meta">
          Proposed by {proposerLabel(p.created_by)}
          {' · '}
          {windowOpen
            ? <span class="decision-card-window">closes {relTime(ms)}</span>
            : <span class="decision-card-closed">voting closed</span>}
        </p>

        {p.source && <p class="decision-card-source">From {p.source}</p>}

        {windowOpen && (
          <>
            <div class="decision-actions">
              <button
                class={`decision-vote decision-vote--agree ${p.my_vote === 'agree' ? 'is-selected' : ''}`}
                onClick={() => vote('agree')}
                disabled={busy}
                aria-pressed={p.my_vote === 'agree'}
              >
                Agree
              </button>
              <button
                class={`decision-vote decision-vote--pass ${p.my_vote === 'pass' ? 'is-selected' : ''}`}
                onClick={() => vote('pass')}
                disabled={busy}
                aria-pressed={p.my_vote === 'pass'}
              >
                Pass
              </button>
              <button
                class={`decision-objection-trigger ${p.my_vote === 'block' ? 'is-selected' : ''}`}
                onClick={() => setObjectionOpen((v) => !v)}
                disabled={busy}
                aria-expanded={objectionOpen}
              >
                {p.my_vote === 'block' ? 'Objection raised' : 'Raise objection'}
              </button>
            </div>

            {objectionOpen && (
              <form class="decision-objection" onSubmit={submitObjection}>
                <label class="decision-objection-label" for={`obj-${p.community_id}-${p.id}`}>
                  A block stops this decision until your community resolves it. Say why.
                </label>
                <textarea
                  id={`obj-${p.community_id}-${p.id}`}
                  class="decision-objection-input"
                  placeholder="Why can't you live with this? Your community's facilitator will see this."
                  value={reason}
                  onInput={(e) => setReason(e.target.value)}
                  rows="3"
                  required
                />
                <div class="decision-objection-actions">
                  <button
                    type="button"
                    class="decision-btn-ghost"
                    onClick={() => { setObjectionOpen(false); setReason(''); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" class="decision-objection-submit" disabled={busy || !reason.trim()}>
                    {busy ? 'Submitting…' : 'Submit objection'}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        <div class="decision-card-foot">
          <span class="decision-tally">
            {t.agree} agree · {t.disagree} disagree · {t.pass} pass · {t.block} block
          </span>
          {p.my_vote && CAST_LABEL[p.my_vote] && (
            <span class="decision-myvote">You {CAST_LABEL[p.my_vote]}</span>
          )}
        </div>

        {error && <p class="decision-card-error">{error}</p>}
      </div>
    </article>
  );
}
