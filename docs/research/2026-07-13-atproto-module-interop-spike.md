# ATProto module interop spike — Tangled & Leaflet

**Date:** 2026-07-13
**Status:** research + design direction (no code)
**Tracks:** my-community#48 (interop epic), community-admin#53 (aggregation layer), #42 (facets), #47 (Network API audit)
**Verification:** all findings grounded in live sources (firecrawl scrapes + direct XRPC calls) on 2026-07-13.

## Question

Should My Community integrate other ATProto-based apps (Tangled = git collaboration, Leaflet = publishing) as read-only "modules" that communities enable and members toggle? Where does the boundary sit between My Community (MC), community-admin (CA), and the apps themselves? Is it feasible?

## Verdict

**Yes, feasible.** Both are readable **read-only, unauthenticated, with no backend from us.** The work is days, not weeks, for basic cards. Recommended first module: **Leaflet as a link-out card** (lowest-risk, verified path). Tangled second.

## Per-product findings

### Tangled (`sh.tangled.*`, git collaboration)

- ATProto-native. Records (`sh.tangled.repo`, `.repo.issue`, `.repo.pull`, `.feed.star`, `.graph.follow`, `.actor.profile`) live in users' PDSs; git objects live on self-hostable **"knots"**. Open-source, monorepo at `tangled.org/tangled.org/core`.
- **Has a public no-auth XRPC AppView, "Bobbin", at `https://api.tangled.org/`** (`sh.tangled.repo.listRepos?subject=<did>`, `.getRepo`, `.actor.getProfile`, `.search.query`). One-call aggregation per DID.
  - Caveat: Bobbin is **days old**, in-RAM, rebuilds its index from a firehose backfill on every restart (30s–20min warm-up), returns bare `rkey`s (no sequential `#42` issue numbers), no published SLA/rate limit.
- **Fallback read path (universal):** `com.atproto.repo.listRecords` / `getRecord` on a known DID's PDS — unauthenticated, works for any collection. Gives raw records; no cross-repo aggregation, no git diff content (that lives on the `knot` named in the repo record).
- **No org/community concept.** A community presence = a shared account DID, or a curated list of member DIDs to fan out over. `listRepos?subject=<did>` if there's a shared account.
- Maturity: **alpha, breaking wire changes roughly monthly** (documented migration guide). Very active.

### Leaflet (`pub.leaflet.*`, publishing — by Hyperlink Academy)

- ATProto-native publishing. Records: `pub.leaflet.publication` (blog container), `pub.leaflet.document` (a post: flat `title` / `description` / `publishedAt` / `publication` at-uri / `coverImage` blob / `pages[]`). MIT-licensed; self-hosting not officially supported.
- Body is a **blocks + facets** model (21 block types; text blocks carry `plaintext` + byte-range `facets[]`), the **same idiom as Bluesky posts** — so a renderer shares code with #42.
- **No public AppView / XRPC query API.** Their own site reads a private Supabase index. Third-party indexers (docs.surf, ufos.microcosm.blue, aturi.to) read the firehose.
- **Read path (verified live):** resolve DID→PDS (`plc.directory`), then unauthenticated `com.atproto.repo.listRecords?collection=pub.leaflet.document` on the owning PDS → full records. Cover image via `com.atproto.sync.getBlob`.
- **Cheapest card = link-out:** flat fields + the post's OpenGraph tags + a permalink (`leaflet.pub/lish/<did>/<pub-rkey>/<doc-rkey>` or a custom domain). Inline block-body rendering is a bounded few-day job on top.
- **Multi-author publications supported:** documents live in each author's own repo but point at a shared `publication` at-uri. But **no "list posts in publication X" endpoint** — must enumerate known contributor DIDs and filter, or use a third-party indexer.
- Maturity: **beta**, converging toward a shared cross-app schema `site.standard.*` (with WhiteWind, Offprint, pckt).

## Architecture takeaways (these updated the whiteboard)

1. **Auth is free for reads.** Both paths are unauthenticated public reads. The member's OAuth/DPoP session is irrelevant to surfacing a community's *public* content — it matters only for writes / personalization later. Simplifies v1.

2. **The real reusable substrate is an MC capability, not CA.** Today MC only ever calls the logged-in user's own `session.pdsUrl`. Both modules (and every future one) need **generic DID→PDS resolution + read-any-collection**. Build that once; it's the platform piece.

3. **CA is the missing aggregation layer.** Neither app answers "this community's feed." The pointers to fan out over (shared account DID / member-DID list / `at://` URI) belong in community-admin, which already stores member DIDs and is already the config source of truth. **CA declares the directory; MC reads ATProto directly. CA supplies pointers, never proxies content.** Tracked in community-admin#53.

4. **Target `site.standard.*`, not just `pub.leaflet.*`.** Building the publishing reader against the emerging cross-app standard means one adapter reads Leaflet + WhiteWind + others — a hedge against betting on one young app.

5. **Maturity is a real risk.** Thin adapters, expect to update (Tangled ~monthly). Don't over-invest before there's a working integration.

## Recommended sequencing (YAGNI)

1. Generic DID→PDS resolver + read-any-collection helper (the substrate).
2. **Leaflet link-out card** as the first concrete module (verified, lowest-risk; maps onto the reading/Digest surface MC already does well).
3. Tangled second (via Bobbin once it stabilizes; great fit for a builders club).
4. Generalize the "module" abstraction from 2-3 real examples — likely plugging into the #39 unified-feed "kinds" substrate, not a new plugin system.

Do **not** build a general module framework before one real integration works.

## Control model

- **Community installs a module** → community-admin (admin decision; declares pointers + config).
- **Member shows / hides it** → MC settings (personal pref, mirroring existing per-tab visibility toggles).
- Read-only first; write-actions (create a Leaflet doc / open a Tangled issue from MC) are far future and need write scopes.

## What stays homemade

Where no mature ATProto product exists, homemade is correct: Harmonica sessions, scenius events, and Community Input (consent/decisions — no mature ATProto governance app yet). The module architecture is the hedge: MC becomes source-agnostic, so a mature ATProto equivalent can be swapped in later without a rewrite.
