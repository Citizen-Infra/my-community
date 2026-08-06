import { useEffect, useState } from 'preact/hooks';
import { callProposals } from '../store/proposals';
import { support, syncSupport, toggleSupport } from '../store/callProposals';
import { syncAvailability } from '../store/availability';
import { AvailabilityStrip } from './AvailabilityStrip';
import { isConnected } from '../store/auth';
import { setActiveTab } from '../store/panels';
import { allCommunities } from '../store/communities';
import { getCommunityColors } from '../lib/community-colors';

// Call-proposals published to a community's Bluesky account (community-admin#54).
// A poll asks WHEN; a proposal asks WHETHER. Same card idiom, different verb: the
// member answers by liking the post, which is a DID the scheduler can count, and
// once enough members do the call books itself from their standing availability.
//
// Liking happens here rather than on Bluesky because that IS the feature. A member
// who has to leave the new tab, find the post and like it there mostly will not —
// which is exactly why every proposal so far has expired at zero.

const STATUS = {
  open: { label: 'Gathering', chip: 'gathering' },
  booked: { label: 'Booked', chip: 'booked' },
  fallback: { label: 'Not booked', chip: 'closed' },
  expired: { label: 'Expired', chip: 'closed' },
};

// avails writes booked_slot as a UTC wall-clock with NO zone designator
// ("2026-08-14T15:30"), and JS parses that form as LOCAL time — so read as-is it
// shows every member outside UTC the wrong hour. Normalise before parsing, then
// render in the member's own zone, which is the number they actually need.
function bookedTime(slot, durationMinutes) {
  // Shape-check before parsing rather than trusting Date to reject bad input:
  // V8's fallback parser is lenient enough to turn "not-a-date" into a real
  // timestamp, so Number.isNaN never fires and the card renders a confident,
  // wrong meeting time — the worst thing it could say.
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?([zZ]|[+-]\d{2}:?\d{2})?$/
    .exec(String(slot || '').trim());
  if (!m) return null;
  const [, stamp, zone] = m;
  const withSeconds = /T\d{2}:\d{2}:\d{2}/.test(stamp) ? stamp : `${stamp}:00`;
  const d = new Date(`${withSeconds}${zone || 'Z'}`);
  if (Number.isNaN(d.getTime())) return null;
  const when = d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return durationMinutes ? `${when} · ${durationMinutes} min` : when;
}

function closesIn(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return mins <= 1 ? 'closes in under a minute' : `closes in ${mins} minutes`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return hrs <= 1 ? 'closes in about an hour' : `closes in ${hrs} hours`;
  return `closes in ${Math.round(hrs / 24)} days`;
}

// Present tense only while the answer can still change. A settled proposal
// reporting "1 person wants this" reads as though it were still open.
function supportText(count, gathering) {
  if (count === undefined) return null; // not synced yet — say nothing rather than zero
  if (gathering) {
    if (count === 0) return 'No one yet';
    return count === 1 ? '1 person wants this' : `${count} people want this`;
  }
  if (count === 0) return 'No one answered';
  return count === 1 ? '1 person said yes' : `${count} people said yes`;
}

function CallProposalCard({ proposal: p }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const colors = getCommunityColors(p.community_id);
  const community = allCommunities.value.find((c) => c.id === p.community_id);
  const communityName = community?.name || p.community_id;

  const state = STATUS[p.status] || STATUS.open;
  const gathering = !p.outcome && p.status === 'open';
  const entry = support.value[p.post_uri];
  const count = entry?.likeCount;
  const isIn = !!entry?.likeUri;
  const booked = bookedTime(p.booked_slot, p.duration_minutes);
  const ms = new Date(p.closes_at).getTime() - Date.now();

  async function onToggle() {
    setError(null);
    setBusy(true);
    try {
      await toggleSupport(p);
    } catch (err) {
      setError(err.message || 'Could not record your response.');
    }
    setBusy(false);
  }

  return (
    <article
      class="session-card call-card"
      style={{ '--community-border': colors.border, '--community-bg': colors.bg, '--community-text': colors.text }}
    >
      <div class="session-card-accent" aria-hidden="true" />
      <div class="session-card-body">
        <div class="session-card-header">
          <div class="session-card-meta">
            <span class={`call-status-badge call-status-badge--${state.chip}`}>{state.label}</span>
            <span
              class="session-community-badge"
              style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
            >
              {communityName}
            </span>
          </div>
          {gathering && ms > 0 && <span class="session-time">{closesIn(ms)}</span>}
        </div>

        <h4 class="session-title">{p.title}</h4>
        {p.body && <p class="session-description">{p.body}</p>}

        {/* A booked call appears nowhere else in My Community — the Participation
            feed reads avails polls, not bookings — so this card is its only record. */}
        {booked && <p class="call-booked">{booked}</p>}

        <div class="call-card-footer">
          <span class="call-count" aria-live="polite">{supportText(count, gathering)}</span>

          {gathering && isConnected.value && (
            <button
              type="button"
              class={`call-support ${isIn ? 'is-in' : ''}`}
              onClick={onToggle}
              disabled={busy}
              aria-pressed={isIn}
            >
              {busy ? 'Saving…' : isIn ? "You're in" : 'Count me in'}
            </button>
          )}

          {gathering && !isConnected.value && (
            <button type="button" class="call-connect" onClick={() => setActiveTab('network')}>
              Connect Bluesky to answer
            </button>
          )}
        </div>

        {error && <p class="call-error">{error}</p>}

        {/* Only once they have said yes. Before that the ask is "do you want
            this call", and stacking "and when are you free, forever" on top of
            an unanswered question is two decisions where the card had one.
            After the like it is the same decision continued: they want the
            call, so the useful next thing is making it bookable. */}
        {gathering && isConnected.value && isIn && <AvailabilityStrip proposal={p} />}
      </div>
    </article>
  );
}

export function CallProposalCards() {
  const list = callProposals.value;
  // Stable dep: re-sync when the set of proposals changes, and again when the
  // member connects Bluesky, since only an authenticated read carries viewer.like.
  const key = list.map((p) => p.post_uri).join(',');

  useEffect(() => {
    if (list.length === 0) return;
    syncSupport(list);
    // One listRecords over the member's own repo covers every proposal here,
    // so this is a second call for the page, not a second call per card.
    if (isConnected.value) syncAvailability(list);
  }, [key, isConnected.value]);

  if (list.length === 0) return null;

  return (
    <div class="session-group">
      <h3 class="session-group-title call-group-title">Should we meet?</h3>
      <div class="session-list">
        {list.map((p) => (
          <CallProposalCard key={`${p.community_id}-${p.id}`} proposal={p} />
        ))}
      </div>
    </div>
  );
}
