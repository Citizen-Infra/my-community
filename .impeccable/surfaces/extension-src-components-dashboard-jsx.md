---
version: 1
slug: "extension-src-components-dashboard-jsx"
primary_target: "extension/src/components/Dashboard.jsx"
related_targets: ["extension/src/components/TabBar.jsx","extension/src/store/panels.js"]
---

# Dashboard tiles surface brief

**Mode:** Operate. A member opening a new browser tab should understand the community pulse without scrolling the dashboard overview.

**Scope:** Present enabled feeds in an adaptive overview with no redundant main-area page heading. Four feeds form a 2×2 mosaic; fewer feeds expand to use the space. Each tile auto-fits as many complete, civic-priority preview rows as its available height allows, with a locally persisted exact-count override. Visible rows divide the tile body evenly, becoming multiline editorial summaries when sparse and compact scan lines when dense. Rows deep-link to their item; headings and footers open the complete feed. Community Input rows show civic state without repeating community names already present in the tile subtitle. Footer actions remain hidden until the pointer is over tile chrome or unused space, recede while a specific item is hovered, and remain visible on keyboard focus. A compact sliders control beside Dashboard in the sidebar toggles Customize mode, which supports pointer drag, 44px keyboard controls, preview-depth selectors, contextual guidance, and Reset layout. Customize, collection Sort, and trailing Delete align to one right-edge control column; hidden row actions release their width to collection names. Decorative feed-color bars are removed, top-bar search remains identical to Collections pages, and the Collections sidebar retains its established width so names are not compressed.

**Persistent preview contract:** Selector-matched cached content remains visible beyond its refresh TTL. Never-loaded feeds populate sequentially after first paint; afterward, refreshes are limited to the most recently focused feed on a new tab and any feed explicitly opened. Private previews are keyed to both the selected communities and current account.

## Direction contract

**THESIS:** A community front page, not a tab strip or widget grid.

**OWN-WORLD:** Warm paper, editorial type, quiet rules, community provenance, and forest-green action. Civic state—not decorative feed color—carries emphasis.

**STORY:** Scan four community signals, choose one, read deeply, return.

**FIRST VIEWPORT:** Quiet supporting chrome frames a gapless 2×2 editorial mosaic beginning immediately in the main area; every tile uses its available height for complete preview rows with useful civic status and evidence. Tile subtitles state scope—active Network filters or selected communities—instead of loaded-item totals. Digest rows avoid repeated community names; Network rows pair handles with reply and repost counts. Customize is represented by a small secondary control beside Dashboard in the sidebar.

**FORM:** Adaptive almanac front page, shaped directly inside the established world.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
