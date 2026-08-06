import { signal } from '@preact/signals';
import { blueskySession } from './auth';
import { bskyFetch, bskyPost } from '../lib/atproto';

// Standing availability: when a member is generally free for a group's calls,
// published once, to their OWN repo (my-community#49, avails#102).
//
// My Community writes this record directly — no avails API, no community-admin
// write. Two independent apps on one user-owned record with nothing between
// them is the thing that makes the ATProto bet real here rather than
// decorative. It works today because MC's OAuth already asks for
// `atproto transition:generic`, which covers writes to any collection.
//
// Do NOT narrow that scope without first versioning MC's client_id, which is
// unversioned (`${CA_URL}/oauth/client-metadata.json`). A PDS caches the grant
// per client_id and will not re-prompt on a scope change, so writes would start
// failing with ScopeMissingError and the member would never be asked to
// re-authorize. That is avails#49, already paid for once.

const COLLECTION = 'chat.avails.scheduling.availability';

// Eight weeks, matching avails' documented default. A standing offer is a
// pattern-of-life record on a public firehose, so it expires by default rather
// than lingering: the honest half of asking for it at all.
const VALID_WEEKS = 8;

// Three coarse blocks, not an hour grid. A standing offer means "most weeks",
// and asking for 15-minute precision on a claim that vague is false precision
// that costs the member the very friction this capture exists to remove.
export const BLOCKS = [
  { key: 'morning', label: 'Morning', startTime: '09:00', endTime: '12:00' },
  { key: 'afternoon', label: 'Afternoon', startTime: '12:00', endTime: '17:00' },
  { key: 'evening', label: 'Evening', startTime: '17:00', endTime: '21:00' },
];

// `day` follows the lexicon, which follows JS getDay(): 0 = Sunday. Displayed
// Monday-first, which is what the member's week looks like.
export const DAYS = [
  { day: 1, short: 'M', label: 'Monday' },
  { day: 2, short: 'T', label: 'Tuesday' },
  { day: 3, short: 'W', label: 'Wednesday' },
  { day: 4, short: 'T', label: 'Thursday' },
  { day: 5, short: 'F', label: 'Friday' },
  { day: 6, short: 'S', label: 'Saturday' },
  { day: 0, short: 'S', label: 'Sunday' },
];

// The group this offer is for. Mirrors community-admin's own scopeFor: the
// COMMUNITY by default, because that is what the member believes they are
// answering and it outlives any one proposal. A proposal carrying an explicit
// scope_uri is an organizer deliberately pointing one call at a Bluesky list.
export function scopeFor(proposal) {
  return proposal.scope_uri
    ? { type: 'atproto-list', value: proposal.scope_uri }
    : { type: 'ca-community', value: proposal.community_id };
}

export const scopeKey = (scope) => `${scope.type} ${scope.value}`;

// MUST match avails' rkeyForScope (server/src/routes/availability.js):
// sha256 of `type\nvalue`, hex, first 24 chars. One record per scope is
// enforced structurally by that derivation — write a random rkey instead and
// every republish leaves another permanent public record in the member's repo,
// with avails silently reading whichever sorted newest.
export async function rkeyForScope(scope) {
  const bytes = new TextEncoder().encode(`${scope.type}\n${scope.value}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

// Selection keys are `day:blockIndex`; this turns them into lexicon windows,
// merging blocks that touch. Merging matters: avails looks for OVERLAP between
// members, and three abutting windows describe the same span as one while
// giving the solver more edges to miss each other on.
export function windowsFrom(selected) {
  const byDay = new Map();
  for (const key of selected) {
    const [day, block] = String(key).split(':').map(Number);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(block);
  }

  const windows = [];
  for (const [day, blocks] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...new Set(blocks)].sort((a, b) => a - b);
    let run = [sorted[0]];
    for (const block of sorted.slice(1)) {
      if (block === run[run.length - 1] + 1) run.push(block);
      else { windows.push(windowOf(day, run)); run = [block]; }
    }
    windows.push(windowOf(day, run));
  }
  return windows;
}

const windowOf = (day, run) => ({
  day,
  startTime: BLOCKS[run[0]].startTime,
  endTime: BLOCKS[run[run.length - 1]].endTime,
});

// The reverse, so reopening the strip shows what was published rather than an
// empty grid the member would have to rebuild from memory.
export function selectionFrom(weekly) {
  const selected = new Set();
  for (const w of weekly || []) {
    BLOCKS.forEach((block, i) => {
      if (block.startTime >= w.startTime && block.endTime <= w.endTime) selected.add(`${w.day}:${i}`);
    });
  }
  return selected;
}

// scopeKey -> the member's record for that scope, or null when they have none.
// Absent from the map means "not read yet", which is a third state and must not
// render as "you have not published" — that would invite a member to republish
// something they already have.
export const availability = signal({});

function isLive(record) {
  const until = record?.value?.validUntil;
  return !until || new Date(until).getTime() > Date.now();
}

// One read covers every proposal on the page: the member's own repo holds all
// their scopes, so this lists once and indexes by scope rather than fetching
// per card.
export async function syncAvailability(list) {
  const session = blueskySession.value;
  if (!session) return;

  const scopes = (list || []).map(scopeFor);
  if (scopes.length === 0) return;

  let records;
  try {
    const url = `${session.pdsUrl}/xrpc/com.atproto.repo.listRecords`
      + `?repo=${encodeURIComponent(session.did)}&collection=${encodeURIComponent(COLLECTION)}&limit=100`;
    const res = await bskyFetch(url);
    if (!res || !res.ok) return; // leave unread rather than assert "none"
    records = (await res.json()).records || [];
  } catch {
    return;
  }

  const next = { ...availability.value };
  for (const scope of scopes) {
    const key = scopeKey(scope);
    const match = records.find(
      (r) => r.value?.scope?.type === scope.type && r.value?.scope?.value === scope.value && isLive(r)
    );
    next[key] = match || null;
  }
  availability.value = next;
}

// Create or replace the member's standing availability for one scope.
//
// putRecord at the derived rkey, never createRecord: this is a create-or-
// replace, and the whole point of deriving the key from the scope is that
// republishing edits one record instead of accumulating public ones. Carries
// createdAt across so an edit does not reset the original publish date, and
// swaps on the prior cid so a concurrent edit fails loudly instead of silently
// dropping the other write.
export async function publishAvailability(proposal, selected) {
  const session = blueskySession.value;
  if (!session) throw new Error('Connect Bluesky first.');

  const weekly = windowsFrom(selected);
  if (weekly.length === 0) throw new Error('Choose at least one time first.');

  const scope = scopeFor(proposal);
  const key = scopeKey(scope);
  const rkey = await rkeyForScope(scope);
  const prior = availability.value[key];

  const now = new Date().toISOString();
  const validUntil = new Date(Date.now() + VALID_WEEKS * 7 * 86400000).toISOString();
  const record = {
    $type: COLLECTION,
    scope,
    pattern: { weekly },
    // The member's own zone. The lexicon interprets every window in it, so a
    // wrong one silently offers the wrong hours to everybody else.
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    // Always 'confirm'. Auto-booking is a larger promise than a member can
    // meaningfully give while answering one proposal; avails returns
    // confirm-members separately and never commits them, so the call still
    // books. An "always free to be booked" choice belongs where a member is
    // reviewing this record, not where they are first making it.
    trust: 'confirm',
    validUntil,
    createdAt: prior?.value?.createdAt || now,
    ...(prior ? { updatedAt: now } : {}),
  };

  const res = await bskyPost(`${session.pdsUrl}/xrpc/com.atproto.repo.putRecord`, {
    repo: session.did,
    collection: COLLECTION,
    rkey,
    record,
    ...(prior?.cid ? { swapRecord: prior.cid } : {}),
  });
  if (!res || !res.ok) throw new Error('Could not save your times.');
  const data = await res.json();

  availability.value = { ...availability.value, [key]: { uri: data.uri, cid: data.cid, value: record } };
}

// "Tuesday and Thursday mornings, Monday afternoons" — the published record read
// back in the member's own words, so the card can show what they said without
// reopening the grid.
export function summarize(weekly) {
  const byBlock = new Map();
  for (const w of weekly || []) {
    BLOCKS.forEach((block, i) => {
      if (block.startTime >= w.startTime && block.endTime <= w.endTime) {
        if (!byBlock.has(i)) byBlock.set(i, []);
        byBlock.get(i).push(w.day);
      }
    });
  }

  const order = DAYS.map((d) => d.day);
  const parts = [...byBlock.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([block, days]) => {
      const names = [...new Set(days)]
        .sort((a, b) => order.indexOf(a) - order.indexOf(b))
        .map((day) => DAYS.find((d) => d.day === day).label);
      return `${joinWords(names)} ${BLOCKS[block].label.toLowerCase()}s`;
    });

  // Commas between the block groups, never "and": the day lists inside already
  // use it, and a second one nests into "Monday and Tuesday mornings, Tuesday
  // afternoons and Monday and Thursday evenings", which reads as one long list
  // of days rather than three groups.
  return parts.join(', ');
}

const joinWords = (items) => (items.length <= 1
  ? items[0] || ''
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
