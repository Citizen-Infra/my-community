---
version: 1
slug: "extension-src-components-dashboard-jsx"
primary_target: "extension/src/components/Dashboard.jsx"
related_targets: ["extension/src/components/TabBar.jsx","extension/src/store/panels.js"]
---

# Dashboard tiles surface brief

**Mode:** Operate. A member opening a new browser tab should understand the community pulse without scrolling the dashboard overview.

**Scope:** Replace feed tabs with an adaptive overview of enabled feeds. Four feeds form a 2×2 mosaic; fewer feeds expand to use the space. Each tile previews real feed content and handles loading, empty, error, and sign-in states. Selecting a tile opens the existing full, scrollable feed; Back returns to the overview. A direct Customize mode supports pointer drag and keyboard move controls. Existing visibility settings, data loading, themes, sidebar, and full-feed behavior remain.

## Direction contract

**THESIS:** A community front page, not a tab strip or widget grid.

**OWN-WORLD:** Warm paper, editorial type, quiet rules, feed-specific modules, and forest-green action.

**STORY:** Scan four community signals, choose one, read deeply, return.

**FIRST VIEWPORT:** Top bar and sidebar frame a gapless 2×2 editorial mosaic; each feed has one strong preview and a clear opening affordance. Customize is quiet but visible.

**FORM:** Adaptive almanac front page, shaped directly inside the established world.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
