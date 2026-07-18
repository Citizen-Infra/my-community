---
date: 2026-07-18
status: shaped (pre-build)
initiative: Unified Community Input Surface (#39), Sub-project E (#5)
repos: [my-community]
---

# Knowledge kind in the unified Community Input feed — design

Add the **knowledge-source** artifact kind (promote-on-threshold, opt-in) to the
Community Input feed that Slice A shipped, alongside the consent decisions already
there. Wired to the existing community-admin `wiki_queue`.

## Seam decision: federate (confirmed 2026-07-18)

Leave `wiki_queue` / `wiki_votes` and their routes untouched. MC fetches BOTH the
decisions endpoint and the wiki-queue endpoint and renders both in one feed. No
backend migration; the live wiki subsystem and its external puller stay green.
This matches the initiative's stated "federation, not a monolith" architecture.
(Migrating `wiki_queue` into `proposals` remains a future option the `proposals`
table was designed for, but is not needed to render two card types in one feed.)

**This makes E an MC-only change** — no community-admin edits.

## Data (`store/knowledge.js`, new — mirrors `store/proposals.js`)

- `wikiItems` signal + `loadWikiQueue(communityIds)`: per community,
  `GET {CA}/communities/:id/wiki/queue` (member-auth via `caSessionHeader()`);
  keep `status ∈ {candidate, ready}` (the votable window) plus `approved`/`processed`
  shown as a resolved "Added to the wiki" card. Skip `rejected`. 403 communities
  are skipped (degrade gracefully), same pattern as `loadProposals`. Short cache.
- `castKnowledgeVote(communityId, queueId, value)`: `POST …/wiki/queue/:queueId/vote`
  with `value ∈ {agree, disagree, pass}` (3-way, no block/reason), patch the item
  in place with the returned row.
- `openUnvotedKnowledgeCount` computed: candidate/ready items with no `my_vote`.

## Card (`components/KnowledgeCard.jsx`, new — reuses `.decision-card*` CSS)

Same card language, community-color theming, and vote→patch UX as `DecisionCard`,
but knowledge-aware:

- Buttons: **Support / Pass / Oppose** → agree / pass / disagree. No objection/reason.
- State from `status` (the client has no threshold number, so status carries it):
  `candidate` → "Gathering support", `ready` → "Ready for the wiki",
  `approved`/`processed` → "Added to the wiki" (resolved, no buttons).
- Body: source title + summary, linked to `url` (opens the source). A `Knowledge` kind
  label distinguishes it from decisions in the mixed feed.
- Foot: net support (`agree − disagree`) and the raw tallies, mirroring the decision tally.

## Feed integration (`CommunityInputFeed.jsx`)

One merged list. Order: items needing your response first (open+unvoted decisions and
candidate/ready+unvoted sources), with time-boxed decisions ahead of deadline-free
knowledge within that tier; then resolved items. Each card carries its kind label so
the mix reads clearly. Broaden the intro + empty-state copy to cover both decisions
and sources (impeccable craft; no em-dash).

## Tab badge

Extend the Community Input badge to count unvoted actionable knowledge too, so it
reads "things awaiting your input" across both kinds (sum the two computeds where the
badge renders).

## Out of scope

- Any backend / DB migration (federate, not migrate).
- Showing a threshold *number* (client doesn't have it; use status).
- Admin approve/reject and the wiki state machine (stay in community-admin).
- Submitting sources to the queue from MC (that's Sub-project C / #3).
- `rejected` items in the feed.

## Build order

1. `store/knowledge.js` (fetch + vote + count).
2. `KnowledgeCard.jsx` via impeccable shape → craft, browser-verified.
3. Merge into `CommunityInputFeed` + broaden copy; wire the badge.
4. Build, verify (logic + headless card render), commit, PR, release.
