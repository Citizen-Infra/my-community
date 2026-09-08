# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

My Community serves CIBC-ecosystem members and other civically engaged people who keep a browser open throughout the day. They encounter it in the brief pause created by opening a new tab and want that moment to show what their communities are doing, what needs their participation, and where they left their own work.

Users are not assumed to be technical. The dashboard and tab manager must remain useful without an account, community selection must be approachable, and signed-in features should deepen participation rather than gate the core experience.

## Product Purpose

My Community replaces the browser's new-tab page with a community dashboard and local tab manager. It keeps community activity present at a glance, makes participation available where people already work, and gives their open tabs a durable home on the same surface.

Success means a new tab quietly reconnects someone with their communities and current work often enough that they prefer it to the browser default. The community dashboard remains the home; tab management is a supporting power feature rather than the product's organizing idea.

## Positioning

My Community turns a high-frequency, otherwise empty browser moment into a community front page. It combines community signals, direct participation, and private tab organization without becoming a general-purpose start-page widget collection or requiring users to adopt another destination.

## Operating Context

- Runs as a Manifest V3 browser extension in Chromium-based browsers such as Chrome and Brave and overrides the new-tab page.
- Opens many times during an ordinary workday, so the first viewport must be useful at a glance and routine opens must avoid unnecessary network requests.
- Lets people scan an adaptive dashboard overview, open one feed for focused reading, and return to the overview.
- Supports an optional community account through email or Bluesky. The Network feed additionally needs a Bluesky connection, and one Bluesky OAuth session can support both.
- Uses community-admin, Scenius Digest, Bluesky/ATProto, Supabase, Navidrome Jam, and Avails as external sources. Individual source failures must not make the rest of the dashboard unusable.

## Capabilities and Constraints

- **Dashboard overview:** previews enabled Digest, Network, Participation, and Community Input feeds as rearrangeable tiles. Each tile defaults to showing as many civic-priority preview items as fit its available height; members can instead save an exact item count per tile. Preview rows open their item, while tile headings and footers open the complete feed. Tile visibility, order, and preview depth are local preferences; hidden feeds retain their position.
- **Focused feeds:** each tile opens its complete feed with the feed's existing controls and scrolling behavior.
- **Community Digest:** shows recent links shared by selected communities.
- **Network:** shows posts from the user's Bluesky network with feed, time-window, repost, and ranking controls.
- **Participation:** combines community events, Harmonica sessions, call proposals, Avails polls, and live jam rooms.
- **Community Input:** combines consent decisions and suggested wiki sources, prioritizing items awaiting the member's response. Members can suggest the current page to a selected community's wiki queue.
- **Tab manager:** saves and closes tabs, organizes them into collections, supports search and reordering, imports browser bookmarks or compatible exports, exports data, and creates local backups.
- **Local-first tab data:** saved tabs, collections, and tab-manager preferences stay on the user's device in browser storage and user-controlled JSON backups. Uninstalling the extension removes its browser-local data.
- **Lazy feed loading:** selector-matched previews remain visible after their refresh TTL. Never-loaded enabled feeds populate sequentially after first paint; routine new tabs refresh only the most recently focused feed rather than fetching every feed. Increasing preview depth reveals already-loaded items and does not request additional pages.
- **Authentication is additive:** account-specific feeds and actions may require sign-in, while unauthenticated and disconnected states remain understandable and usable.
- **Read resilience:** loading, empty, signed-out, and source-error states are explicit. A failed source degrades independently and offers recovery where appropriate.

## Brand Commitments

The product is named **My Community**. Its voice is warm, civic, grounded, editorial, and human rather than corporate or technical. It should feel calm and considered, never urgent or attention-extracting. The durable visual system and anti-references are maintained separately in `DESIGN.md`.

## Evidence on Hand

- The working extension and shipped feature copy live under `extension/` and in `README.md`.
- The current product interface system is documented in `DESIGN.md`.
- Chrome Web Store listing copy, permission rationale, privacy claims, and capture requirements live in `docs/store-listing.md` and `docs/privacy-policy.md`.
- Store screenshots and their provenance are maintained under `docs/screenshots/`.
- Feature decisions and implementation briefs live under `docs/plans/`.
- No user testimonials, adoption benchmarks, or outcome claims are established in this repository; future product work must not fabricate them.

## Product Principles

- **Civic pulse first.** The community dashboard is the home; supporting capabilities must not bury it.
- **Act where context appears.** Participation, consent, scheduling, and wiki contribution should be available from the community signal that makes them relevant.
- **Calm density over widget sprawl.** Show the important signals at a glance without turning the new-tab page into an attention contest.
- **Local and private by default.** Keep personal tab organization on the user's device and make any outward action explicit.
- **Degrade gracefully.** Missing authentication or one unavailable source should not make unrelated feeds or local tools unusable.

## Accessibility & Inclusion

Target WCAG 2.1 AA contrast in light, dark, and system themes. Respect `prefers-reduced-motion`, keep all actions keyboard-reachable with visible focus, provide targets suitable for non-precise pointers, and never rely on color alone to communicate state. Loading, error, authentication, and empty states must be distinguishable in text.
