# Dashboard tiles surface brief

**Mode:** Operate. A member opening a new browser tab should understand the community pulse without scrolling the dashboard overview.

**Scope:** Replace feed tabs with an adaptive overview of enabled feeds. Four feeds form a 2×2 mosaic; fewer feeds expand to use the space. Each tile presents one strong, community-attributed signal and handles loading, empty, error, and sign-in states. The complete normal tile opens the existing full, scrollable feed; Back returns to the overview. A direct Customize mode supports pointer drag and keyboard move controls. Existing visibility settings, themes, and full-feed behavior remain.

**Persistent preview contract:** A matching preview remains visible after its network-refresh TTL rather than reverting to an unloaded tile. Never-loaded enabled feeds populate sequentially after first paint; subsequent network refreshes are limited to the most recently focused feed on a new tab and any feed the member explicitly opens. Cache selectors include the current community selection and account where content is private, so persistence never crosses identities. This keeps the overview useful without restoring every-feed fetching on every new tab.

## Direction contract

**THESIS:** A community front page, not a tab strip or widget grid.

**OWN-WORLD:** Warm paper, editorial type, quiet rules, community provenance, and forest-green action. Decorative feed-color bars are absent; civic state supplies emphasis.

**STORY:** Scan four community signals, choose one, read deeply, return.

**FIRST VIEWPORT:** A quieted top bar and sidebar frame a gapless 2×2 editorial mosaic. Each feed has one decisive preview, one useful count or status, and a whole-tile opening affordance. Customize is quiet but visible.

**FORM:** Adaptive almanac front page, shaped directly inside the established world.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Interaction and hardening

- Actionable civic states such as Needs your response, Happening now, and Open to join outrank passive content without changing the user's tile order.
- Customize replaces whole-tile opening with 44px reorder controls, visible instructions, and Reset order. Reorders remain announced to assistive technology.
- Signed-out, empty, and error tiles explain the next action; opening them leads directly to the existing connection, sign-in, or retry surface.
- The dashboard subordinates collection and tab-search chrome while leaving both available and preserving the `/` search shortcut.
- Narrow layouts retain guidance, use one column, and scroll; focused feeds keep their existing controls and scrolling.
