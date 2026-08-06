import { useState } from 'preact/hooks';
import {
  BLOCKS, DAYS, availability, scopeFor, scopeKey, canPublish,
  publishAvailability, selectionFrom, summarize,
} from '../store/availability';

// The capture surface for standing availability (my-community#49).
//
// This is not a form that appears; it is the card continuing. A member only
// ever thinks about scheduling at one moment — the instant they say they want a
// call — and that moment is here. Put this behind a settings door and nobody
// publishes one, which is the cold-start problem that has left every proposal
// so far expiring at zero.
//
// Coarse on purpose: seven days by morning/afternoon/evening, about four taps.
// The record says "most weeks", so hour precision would be a lie told slowly.

function windowCount(selected) {
  const days = new Set([...selected].map((k) => k.split(':')[0]));
  return days.size;
}

export function AvailabilityStrip({ proposal }) {
  const scope = scopeFor(proposal);
  const existing = availability.value[scopeKey(scope)];

  // undefined = not read yet. Say nothing rather than invite a member to
  // publish something they may already have.
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (existing === undefined) return null;

  // A private community's record would name it in a world-readable repo that is
  // also on the firehose, so the offer cannot live there and there is nowhere
  // else to put it yet. Say that, rather than showing nothing: a strip that
  // silently fails to appear on some cards and not others reads as a bug, and
  // the member would never learn why.
  if (!canPublish(proposal)) {
    return (
      <p class="avail-blocked">
        Saying when you’re free isn’t available for a private community yet — the record would
        live in your public Bluesky account, where it would show that you’re a member.
      </p>
    );
  }

  const open = editing || !existing;

  if (!open) {
    return (
      <div class="avail-summary">
        <p class="avail-summary-text">
          You’re free {summarize(existing.value?.pattern?.weekly)}.
        </p>
        <button
          type="button"
          class="avail-change"
          onClick={() => {
            setSelected(selectionFrom(existing.value?.pattern?.weekly));
            setError(null);
            setEditing(true);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  function toggle(day, block) {
    const key = `${day}:${block}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await publishAvailability(proposal, selected);
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Could not save your times.');
    }
    setBusy(false);
  }

  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const days = windowCount(selected);

  return (
    <div class="avail-strip">
      <p class="avail-prompt">
        {existing ? 'When are you usually free?' : 'You’re in. When are you usually free?'}
      </p>

      <div class="avail-grid" role="group" aria-label="Your usual weekly availability">
        <span aria-hidden="true" />
        {DAYS.map((d) => (
          <span key={`h-${d.day}`} class="avail-day-head" aria-hidden="true">{d.short}</span>
        ))}

        {BLOCKS.map((block, i) => [
          <span key={`l-${block.key}`} class="avail-row-head">{block.label}</span>,
          ...DAYS.map((d) => {
            const on = selected.has(`${d.day}:${i}`);
            return (
              <button
                key={`${d.day}:${i}`}
                type="button"
                class={`avail-cell ${on ? 'is-on' : ''}`}
                aria-pressed={on}
                aria-label={`${d.label} ${block.label.toLowerCase()}`}
                onClick={() => toggle(d.day, i)}
                disabled={busy}
              />
            );
          }),
        ])}
      </div>

      <div class="avail-footer">
        <span class="avail-count" aria-live="polite">
          {days === 0
            ? 'Tap the times you’re usually free'
            : `${zone} · ${days} ${days === 1 ? 'day' : 'days'} a week`}
        </span>
        <button
          type="button"
          class="avail-save"
          onClick={save}
          disabled={busy || days === 0}
        >
          {busy ? 'Saving…' : 'Publish these times'}
        </button>
      </div>

      {/* The scope names who this is FOR, which every member will read as who
          can SEE it. It is not the same thing, and the gap is the most
          dangerous part of this design — so close it here, in one line, at the
          moment of publishing rather than in a settings page nobody opens. */}
      <p class="avail-note">
        Saved to your own Bluesky account, where anyone can read it. Expires in 8 weeks
        unless you change it.
      </p>

      {error && <p class="call-error">{error}</p>}
    </div>
  );
}
