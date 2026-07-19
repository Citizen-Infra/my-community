# Sub-project F v1 Implementation Plan — Avails Publish + POLL Cards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creators publish an avails poll to their community's feed (opt-in, membership-gated); My Community renders published polls as first-class cards in the Participation tab.

**Architecture:** PDS record field (`communityFeedPublishedAt`, presence = published) as source of truth + in-memory index mirror for the filterable list; one shared publish implementation behind an MCP tool and an HTTP route; MC swaps the banner strip for poll cards. Design: `2026-07-19-mc-poll-cards-avails-publish-design.md`.

**Tech Stack:** avails = Node/Express + ATProto PDS records + in-memory index (Railway volume persistence), vitest. MC = Preact + signals, no test framework.

## Global Constraints

- **Two repos.** Tasks 1–6 in `avails/` (its own branch/PR per its conventions); Tasks 7–8 in `my-community/` (branch + PR, squash-merge). Do not mix repos in one commit.
- Anchor line numbers below were verified 2026-07-19; re-locate by symbol name if drifted.
- Avails auth pattern for tools (copy this, NOT `publish_to_openmeet`'s broken `requireAuth`): `if (!authContext) throw new Error('AUTH_REQUIRED'); if (!authContext.oauthSession) throw new Error('AUTH_REQUIRED');` (`server/src/mcp/tools.js:422-423`) + creator check `if (authContext.did !== did) throw ...` (`tools.js:555-557`).
- Membership gate: `assertMembership(did, community)` from `server/src/lib/membership.js` — reuse as-is, call BEFORE any side effect (the `share_poll` ordering, `tools.js:640-644`).
- PDS writes: clone the best-effort `getRecord → putRecord` (+`swapRecord`) block from `publishToOpenmeet` (`tools.js:815-833`) — wrapped in try/catch so a failed record write never fails the action; the index update is the operative state.
- Poll list response fields are camelCase (`responseCount`, `createdAt`). MC deep link: `https://avails.zhgnv.com/p/${did}/${rkey}`.
- MC visual work MUST route through impeccable (`shape` → `craft` → `polish`); no em dashes in user-facing copy; icon libraries only, no raw SVG beyond existing inline cues.
- Avails tests: `cd server && npx vitest run` (existing suite; mock `fetch`/membership as `server/test/mcp-share-poll.test.js` does). MC: `cd extension && npm run build` (PowerShell) + headless screenshot eyeball.
- No AI attribution outside commit trailers; PR bodies use "Refs #N", never closing keywords.

---

### Task 1 (avails): Index support — `publishedAt` + filter

**Files:**
- Modify: `server/src/lib/pollIndex.js` (`indexPoll` ~:10-22, `updatePollStatus` ~:24-31, `listByCommunity` ~:48-58)
- Test: `server/test/poll-index-published.test.js` (new)

**Interfaces:**
- Produces: index entries carry `publishedAt: string|null`; `updatePollPublished(did, rkey, publishedAt)`; `listByCommunity(community, status, { publishedOnly })`.

- [ ] **Step 1: Failing test**

```js
import { beforeEach, expect, test } from 'vitest';
import { indexPoll, updatePollPublished, listByCommunity, _clearForTests } from '../src/lib/pollIndex.js';

beforeEach(() => _clearForTests?.());

const poll = (rkey, extra = {}) => ({
  did: 'did:plc:alice', rkey, title: `Poll ${rkey}`, community: 'cibc', status: 'open',
  responseCount: 0, createdAt: '2026-07-01T00:00:00Z', ...extra,
});

test('indexPoll defaults publishedAt to null; updatePollPublished sets and clears it', () => {
  indexPoll(poll('p1'));
  expect(listByCommunity('cibc', 'open')[0].publishedAt ?? null).toBeNull();
  updatePollPublished('did:plc:alice', 'p1', '2026-07-19T12:00:00Z');
  expect(listByCommunity('cibc', 'open')[0].publishedAt).toBe('2026-07-19T12:00:00Z');
  updatePollPublished('did:plc:alice', 'p1', null);
  expect(listByCommunity('cibc', 'open')[0].publishedAt ?? null).toBeNull();
});

test('listByCommunity publishedOnly filters to published polls', () => {
  indexPoll(poll('p1'));
  indexPoll(poll('p2'));
  updatePollPublished('did:plc:alice', 'p2', '2026-07-19T12:00:00Z');
  expect(listByCommunity('cibc', 'open', { publishedOnly: true }).map((p) => p.rkey)).toEqual(['p2']);
  expect(listByCommunity('cibc', 'open').map((p) => p.rkey).sort()).toEqual(['p1', 'p2']); // back-compat
});
```

If `pollIndex.js` has no test-reset export, add `export function _clearForTests() { polls.clear(); }` (match the module's actual Map name).

- [ ] **Step 2: Run** — `npx vitest run test/poll-index-published.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `indexPoll()`, carry `publishedAt: poll.publishedAt ?? existing?.publishedAt ?? null` (preserve on re-index, mirroring how the entry is rebuilt). Add:

```js
export function updatePollPublished(did, rkey, publishedAt) {
  const entry = polls.get(`${did}/${rkey}`);
  if (!entry) return;
  entry.publishedAt = publishedAt;
  schedulePersist?.(); // use whatever persistence trigger updatePollStatus uses
}
```

Extend `listByCommunity(community, status, opts = {})` with `if (opts.publishedOnly && !entry.publishedAt) continue;` (or the equivalent `.filter`).

- [ ] **Step 4: Run** — PASS. Full avails suite — green.
- [ ] **Step 5: Commit** — `feat: poll index carries publishedAt + publishedOnly filter (community feed)`

---

### Task 2 (avails): `GET /api/polls` `published=1` param

**Files:**
- Modify: `server/src/routes/polls.js` (list handler ~:81-88)
- Test: `server/test/polls-published-filter.test.js` (new; use the suite's existing route-test bootstrap if one exists, else exercise via supertest on the exported app/router)

**Interfaces:**
- Produces: `GET /api/polls?community=X&status=open&published=1` → published-only. No `published` param → unchanged behavior.

- [ ] **Step 1: Failing test** — seed the index with one published + one unpublished open poll (Task 1 helpers); assert the route returns both without the param and only the published one with `published=1`.
- [ ] **Step 2: Implement**

```js
router.get('/', (req, res) => {
  const { community, status, published } = req.query;
  if (!community) return res.status(400).json({ error: 'community query param required' });
  const polls = listByCommunity(community, status || 'open', { publishedOnly: published === '1' });
  res.json({ polls });
});
```

- [ ] **Step 3: Run** — PASS. **Step 4: Commit** — `feat: published=1 filter on GET /api/polls`

---

### Task 3 (avails): Shared publish action + MCP tool + route

**Files:**
- Create: `server/src/lib/communityFeed.js`
- Modify: `server/src/mcp/tools.js` (TOOL_DEFINITIONS after `publish_to_openmeet` ~:315; `callTool` switch ~:1076), `server/src/routes/polls.js`
- Test: `server/test/mcp-publish-community-feed.test.js` (new; mock membership + PDS like `mcp-share-poll.test.js`)

**Interfaces:**
- Produces: `setCommunityFeedPublished({ did, rkey, published, authContext })` → `{ publishedAt }`; MCP tool `publish_to_community_feed { did, rkey, published? }`; `POST /api/polls/:did/:rkey/publish-community { published }`.

- [ ] **Step 1: Failing tests** — cover: (a) no/invalid auth → `AUTH_REQUIRED`; (b) non-creator → error, no index change, membership never called; (c) creator + member → index `publishedAt` set, PDS write attempted best-effort; (d) `published: false` clears; (e) non-member (mock `assertMembership` rejecting) → error BEFORE any index/PDS mutation; (f) poll without `community` → clear error.
- [ ] **Step 2: Implement `server/src/lib/communityFeed.js`**

```js
import { assertMembership } from './membership.js';
import { updatePollPublished } from './pollIndex.js';

// Publish/unpublish a poll to its community's dashboard feed (#5 sub-project F).
// Source of truth is communityFeedPublishedAt on the PDS record (openmeetEventSlug
// convention: presence = published); the index mirror is what the list endpoint
// filters on. Gates, in order: auth, creator, community membership — before any
// side effect (the share_poll ordering).
export async function setCommunityFeedPublished({ did, rkey, published, authContext }) {
  if (!authContext || !authContext.oauthSession) throw new Error('AUTH_REQUIRED');
  if (authContext.did !== did) throw new Error('Only the poll creator can publish it to the community feed');

  const poll = await getPollRecord(did, rkey); // reuse the record-fetch helper publishToOpenmeet uses
  if (!poll.community) throw new Error('Poll has no community set');
  await assertMembership(authContext.did, poll.community);

  const publishedAt = published === false ? null : new Date().toISOString();
  updatePollPublished(did, rkey, publishedAt);

  // Best-effort PDS persist — clone the try/catch putRecord block from
  // publishToOpenmeet (tools.js:815-833), writing communityFeedPublishedAt
  // (or removing it when null) instead of openmeetEventSlug.
  await persistCommunityFeedField(did, rkey, publishedAt, authContext).catch(() => {});

  return { publishedAt };
}
```

(`getPollRecord` / `persistCommunityFeedField`: extract or mirror the exact fetch/persist code paths `publishToOpenmeet` uses at `tools.js:737-843` — same agent/session API, different field. Keep them in this module.)

- [ ] **Step 3: MCP tool.** TOOL_DEFINITIONS entry (after `publish_to_openmeet`):

```js
{
  name: 'publish_to_community_feed',
  description: 'Publish (or unpublish) a poll to its community\'s dashboard feed in My Community. Creator-only; requires community membership.',
  inputSchema: {
    type: 'object',
    properties: {
      did: { type: 'string', description: 'Poll creator DID' },
      rkey: { type: 'string', description: 'Poll record key' },
      published: { type: 'boolean', description: 'false to unpublish (default true)' },
    },
    required: ['did', 'rkey'],
  },
},
```

`callTool` case: `case 'publish_to_community_feed': return publishToCommunityFeed(args, authContext);` where the handler destructures and delegates to `setCommunityFeedPublished`.

- [ ] **Step 4: Route** (in `routes/polls.js`, auth middleware per the repo's authed routes):

```js
router.post('/:did/:rkey/publish-community', requireAuth, async (req, res) => {
  try {
    const result = await setCommunityFeedPublished({
      did: req.params.did, rkey: req.params.rkey,
      published: req.body?.published !== false,
      authContext: req.authContext, // adapt to how authed routes expose the session
    });
    res.json(result);
  } catch (err) {
    const msg = err?.message || 'publish failed';
    res.status(msg === 'AUTH_REQUIRED' ? 401 : 403).json({ error: msg });
  }
});
```

- [ ] **Step 5: Run tests** — PASS; full suite green. **Step 6: Commit** — `feat: publish_to_community_feed (MCP tool + route, shared impl, membership-gated)`

---

### Task 4 (avails): One-time index backfill (grandfather open polls)

**Files:**
- Modify: `server/src/lib/persistence.js` (load path ~:18-40)
- Test: `server/test/persistence-backfill.test.js` (new)

- [ ] **Step 1: Failing test** — loading a persisted snapshot WITHOUT the marker: every `status==='open'` entry gets `publishedAt = createdAt`, closed entries untouched, marker set; loading WITH the marker: no changes (idempotent).
- [ ] **Step 2: Implement.** In the load path, after entries are restored:

```js
// One-time grandfather (2026-07-19, sub-project F): polls created under the
// all-visible regime stay visible when the feed becomes opt-in. Index-level
// only — the server holds no creator sessions, so it cannot write PDS records
// retroactively. Self-heals as these polls close.
if (!state.communityFeedBackfillDone) {
  for (const entry of polls.values()) {
    if (entry.status === 'open' && !entry.publishedAt) entry.publishedAt = entry.createdAt;
  }
  state.communityFeedBackfillDone = true;
  schedulePersist();
}
```

(Adapt `state` to wherever the persisted snapshot keeps top-level metadata; if it's entries-only, persist the marker as a reserved key or sidecar field — implementer's call, tested either way.)

- [ ] **Step 3: Run** — PASS. **Step 4: Commit** — `feat: one-time community-feed backfill for open polls`

---

### Task 5 (avails): Fix `publish_to_openmeet` broken auth

**Files:**
- Modify: `server/src/mcp/tools.js` (`publishToOpenmeet` ~:737-738)
- Test: extend `server/test/mcp-publish-community-feed.test.js` or the existing openmeet test file

- [ ] **Step 1: Failing test** — calling `publish_to_openmeet` via `callTool` with no auth context must throw `AUTH_REQUIRED` (today it throws `ReferenceError: requireAuth is not defined`).
- [ ] **Step 2: Implement** — replace `const auth = requireAuth(authContext);` with the standard pattern:

```js
  if (!authContext || !authContext.oauthSession) throw new Error('AUTH_REQUIRED');
  const auth = authContext;
```

(plus the creator check if absent downstream — verify against the function body before adding).

- [ ] **Step 3: Run** — PASS; full suite green. **Step 4: Commit** — `fix: publish_to_openmeet called undefined requireAuth (broken via MCP since introduction)`

---

### Task 6 (avails): PollView Publish/Unpublish button

**Files:**
- Modify: `client/src/pages/PollView.jsx` (near the OpenMeet button ~:730-736 + handler ~:534-562), `client/src/lib/api.js`

- [ ] **Step 1: api.js client fn**

```js
export const publishToCommunityFeed = (did, rkey, published = true) =>
  authedFetch(`/api/polls/${did}/${rkey}/publish-community`, {
    method: 'POST', body: JSON.stringify({ published }),
  });
```

(match `api.js`'s existing fetch helper idiom, e.g. how `publishToOpenmeet` at `api.js:32` wraps it).

- [ ] **Step 2: Button.** Creator-only, visible while the poll is OPEN (unlike OpenMeet's scheduled-only gate): shows "Publish to community feed" when `!poll.communityFeedPublishedAt`, "Unpublish from community feed" when set; handler mirrors `handlePublishToOpenMeet` (loading state, error surface, optimistic field update). Membership errors from the route render as the API's error message.
- [ ] **Step 3: Verify** — client build passes; manual check on a dev poll. **Step 4: Commit** — `feat: PollView publish-to-community-feed button`

**Deploy gate (avails):** after Tasks 1–6 merge, deploy per avails' Railway setup and verify in prod: publish a test poll via the button, `curl 'https://avails.zhgnv.com/api/polls?community=cibc&published=1'` shows it, unpublish removes it.

---

### Task 7 (my-community): Poll cards replace the banner

**Files:**
- Modify: `extension/src/store/avails.js`, `extension/src/components/SessionsPanel.jsx`, `extension/src/styles/sessions.css`
- Delete (after replacement): `extension/src/components/AvailsBanner.jsx` usage for polls (the `LiveStrip` stays for jams)

**IMPECCABLE GATE:** run `/impeccable shape` for the poll-card group before writing markup; `craft` to build; `polish` before ship. The structure below is the functional contract, not the final visual design.

- [ ] **Step 1: Store** — `store/avails.js:13`: append `&published=1` to the fetch URL. No other store changes (polling cadence, dedupe stay).
- [ ] **Step 2: Cards.** In `SessionsPanel.jsx`: replace `<AvailsBanner />` with a "Finding a time" `session-group` rendered ABOVE "Happening Now"/"Coming Up" when `availsPolls.value.length > 0`. Each poll renders in the `SessionCard` idiom: community accent via `getCommunityColors(poll.community)`, badge "Poll open", title, response count using the CORRECT field — `poll.responseCount ?? 0` (fixes the silent `response_count` casing bug: counts have always shown 0), href `https://avails.zhgnv.com/p/${poll.did}/${poll.rkey}` (new tab), footer action cue "Add your availability".
- [ ] **Step 3: Empty state** — zero published polls simply renders no group (no placeholder).
- [ ] **Step 4: Verify** — `npm run build` (PowerShell); headless screenshot of the Participation tab light + dark (fresh `--user-data-dir` GUID; `data-theme="dark"` on `<html>` for dark); eyeball against DESIGN.md (On-Fill rule, community accent bar is the only >1px side accent).
- [ ] **Step 5: Commit + PR** — `feat: participation poll cards (published avails polls) replace banner strip` — "Refs #5 (sub-project F), #6 local task". Squash-merge on approval; version bump + release per house flow when cut.

---

### Task 8 (both): File the deferred avails issues + docs

- [ ] **Step 1: avails issues** (file, don't fix): (a) "Calendar-invite emails link `/poll/:did/:rkey` — route doesn't exist, links 404" (`server/src/routes/polls.js:237` + `:328`; the `/p/` fix commit `5a9a281` only touched the MCP path); (b) "Lexicon `status` enum missing `finalized`" (`lexicons/chat/avails/scheduling/poll.json:25` vs writes at `tools.js:572`, `routes/polls.js:223`).
- [ ] **Step 2: Docs.** avails CLAUDE.md: new tool + route + `communityFeedPublishedAt` + backfill note. MC CLAUDE.md: Participation feed now shows *published* polls as cards (banner retired for polls). Epic #5: comment marking F's v1 shipped scope + deferred remainder (create-time checkbox, EditPollDialog toggle, DDS spike stays with B).
- [ ] **Step 3:** Update local task #6 → build complete when all of the above lands.

---

## Self-review notes

- **Decision coverage:** D1 (avails-cards, no vote primitive) → Task 7 deep-link cards; D2 (Participation tab) → Task 7 placement; D3 (opt-in publish, both repos) → Tasks 1–6 + `published=1` consumer.
- **Bug-scope split** honored: casing fix in Task 7 Step 2, `requireAuth` fix in Task 5; `/poll/` URLs + lexicon enum filed in Task 8, not fixed.
- **Uncertain internals flagged, not fabricated:** PDS fetch/persist helpers (Task 3) and the persistence-marker location (Task 4) are anchored to the exact code paths to mirror (`tools.js:737-843`, `:815-833`) rather than invented API calls; implementer adapts to local idiom, tests pin behavior.
- **Ordering:** Tasks 1→2→3 are dependent; 4, 5 independent after 1; 6 after 3; 7 after the avails deploy gate; 8 last.
