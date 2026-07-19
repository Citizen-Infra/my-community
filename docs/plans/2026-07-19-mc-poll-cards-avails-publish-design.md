# Sub-project F v1 — Avails Publish + POLL Cards (Design)

**Date:** 2026-07-19. **Status:** approved design; plan at `2026-07-19-mc-poll-cards-avails-publish-implementation-plan.md`. **Epic:** my-community #5, Sub-project F. **Repos:** avails + my-community.

## Context

Epic #5's Sub-project F ("Participation / avails publish + deliberation interop", status: not designed) has two halves: an avails-side "publish to community feed" destination (counterpart of `publish_to_openmeet`) and DDS interop for the participation feed's deliberative sources. The read side is live: `store/avails.js` fetches open polls per community; `AvailsBanner` renders them as compact strips atop the Participation tab.

A 2026-07-19 code check resolved the contested fork the task tracking carried: community-admin's `proposals.kind` column is an inert placeholder (never read or written beyond its default), and avails polls are a structurally different animal (public reads, ATProto records, time-slot responses, no consent vote primitive). The old "#39 Slice C" reference is stale — #39 is an unrelated merged PR; the epic is #5.

## Decisions (locked with the user, 2026-07-19)

1. **POLL = avails polls as first-class feed cards.** No new vote primitive; acting on a poll deep-links to avails. The CA `proposals.kind` seam stays untouched; the DDS-envelope framing is deferred to the sub-project B spike.
2. **They live in the Participation tab** (banner grows into cards among events/sessions). Matches the epic's F text and the poll lifecycle (a scheduling poll becomes an event). Community Input's member-gated authority semantics stay clean.
3. **Opt-in publish, both repos** (full F): avails gains a per-poll "publish to community feed" action; MC renders only published polls.

## Grounding facts (avails, checked 2026-07-19)

- **No database.** Poll = `chat.avails.scheduling.poll` ATProto record in the *creator's* PDS; a server-owned in-memory index (persisted to a Railway volume as JSON) powers `GET /api/polls?community=X&status=open` (`listByCommunity`, a pure Map filter). The list response per poll is thin: `{did, rkey, title, community, status, responseCount, createdAt}`.
- **Publication-marker precedent:** `openmeetEventSlug` on the poll record, written best-effort via the creator's OAuth session during the publish action (presence = published, cleared on unschedule). `googleEventId` follows the same convention.
- **Membership gate exists and is reusable as-is:** `assertMembership(did, community)` (`server/src/lib/membership.js`) calls community-admin's `GET /api/memberships` with the shared secret; fails closed. `share_poll` already gates on it before any side effect.
- **Deep link:** `${CLIENT_URL}/p/${did}/${rkey}` — the route MC's banner already builds.

## v1 shape

**Avails:**
- `communityFeedPublishedAt` (datetime) on the poll record — presence = published, the `openmeetEventSlug` convention — mirrored into the index entry (`publishedAt`).
- One shared `setCommunityFeedPublished()` implementation behind BOTH a `publish_to_community_feed` MCP tool and a `POST /api/polls/:did/:rkey/publish-community` route (improving on the OpenMeet precedent, which duplicated the two paths). Gates, all reused: signed-in (`AUTH_REQUIRED` pattern), creator-only, `assertMembership(authContext.did, poll.community)`.
- Web UI: inline creator-only Publish/Unpublish button on `PollView` (the "Publish to OpenMeet" idiom). Create-time checkbox and `EditPollDialog` toggle deferred.
- `GET /api/polls` gains an opt-in `published=1` filter; no param = today's behavior (back-compat).
- **Transition/grandfathering:** the server cannot write to existing polls' PDS records (no creator session outside their own action), so grandfathering is a one-time **index-level** backfill: currently-open polls get `publishedAt = createdAt` in the index, guarded by a persisted marker, self-healing as polls close. The PDS field is authoritative for all subsequent publishes/unpublishes. No visibility regression.

**My-community:**
- `store/avails.js` requests `&published=1`.
- The banner strip is replaced by a "Finding a time" group in `SessionsPanel` above "Coming Up": poll cards in the `SessionCard` idiom (community accent, "Poll open" badge, response count, deep link; the whole card = go add availability). Visual work routes through impeccable (shape → craft → polish) at build time.

## Bugs found during the check (scope split, approved)

**Fix in-scope** (code this slice touches anyway):
1. MC reads `poll.response_count`; the API sends `responseCount` — counts have silently rendered 0. Fixed in the new card.
2. Avails' `publish_to_openmeet` MCP tool calls an undefined `requireAuth()` — it throws `ReferenceError` before doing anything (the tool is entirely broken via MCP). Replace with the `AUTH_REQUIRED` + creator-check pattern the new tool uses.

**File as avails issues, don't fix here:**
3. Two email paths build dead `/poll/` URLs (no such route; calendar-invite/cancellation links 404). The earlier `/p/` fix only touched the MCP path.
4. The lexicon's `status` enum lists `open`/`closed` but the code writes `finalized` — stale enum.

## Out of scope (recorded)

Harmonica-session DDS interop (sessions already surface via the sessions store), the DDS record-shape spike (sub-project B, per the epic), create-time publish checkbox, `EditPollDialog` publish toggle, unpublish-on-close semantics beyond the existing `status=open` filter (finalized polls already drop out of the list).

## Testing

Avails: vitest (existing suite, `server/test/`) — index publish flag + filter, route gates (401/403 non-creator/non-member via mocked membership), backfill idempotency, and the `publish_to_openmeet` auth fix. MC: no test framework (per repo); build + headless screenshot + live eyeball, per house pattern.
