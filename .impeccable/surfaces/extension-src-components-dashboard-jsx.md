---
version: 1
slug: "extension-src-components-dashboard-jsx"
primary_target: "extension/src/components/Dashboard.jsx"
related_targets: ["extension/src/components/TabBar.jsx","extension/src/store/panels.js"]
---

# Dashboard tiles surface brief

**Mode:** Operate. A member opening a new browser tab should understand the community pulse without scrolling the dashboard overview.

**Scope:** Present enabled feeds in an adaptive overview. Four feeds form a 2×2 mosaic; fewer feeds expand to use the space. Each tile auto-fits as many complete, civic-priority preview rows as its available height allows, with a locally persisted exact-count override. Rows deep-link to their item; headings and footers open the complete feed. Customize supports pointer drag, 44px keyboard controls, preview-depth selectors, and Reset layout. Decorative feed-color bars are removed, and surrounding tab-manager chrome recedes on the dashboard.

**Persistent preview contract:** Selector-matched cached content remains visible beyond its refresh TTL. Never-loaded feeds populate sequentially after first paint; afterward, refreshes are limited to the most recently focused feed on a new tab and any feed explicitly opened. Private previews are keyed to both the selected communities and current account.

## Direction contract

**THESIS:** A community front page, not a tab strip or widget grid.

**OWN-WORLD:** Warm paper, editorial type, quiet rules, community provenance, and forest-green action. Civic state—not decorative feed color—carries emphasis.

**STORY:** Scan four community signals, choose one, read deeply, return.

**FIRST VIEWPORT:** Quiet supporting chrome frames a gapless 2×2 editorial mosaic; every tile uses its available height for complete preview rows with useful civic status and provenance. Customize is quiet but visible.

**FORM:** Adaptive almanac front page, shaped directly inside the established world.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
