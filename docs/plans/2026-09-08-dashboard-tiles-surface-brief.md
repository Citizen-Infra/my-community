# Dashboard tiles surface brief

**Mode:** Operate. A member opening a new browser tab should understand the community pulse without scrolling the dashboard overview.

**Scope:** Replace feed tabs with an adaptive overview of enabled feeds. Four feeds form a 2×2 mosaic; fewer feeds expand to use the space. Each tile presents community-attributed, civic-priority preview items and handles loading, empty, error, and sign-in states. Auto-fit shows as many complete rows as the tile's current height allows, so one or two enabled tiles use their additional space. Customize can persist an exact item count independently for each feed. Preview rows open their item; the tile heading and footer open the existing full, scrollable feed. Back returns to the overview. Existing visibility settings, themes, and full-feed behavior remain.

**Persistent preview contract:** A matching preview remains visible after its network-refresh TTL rather than reverting to an unloaded tile. Never-loaded enabled feeds populate sequentially after first paint; subsequent network refreshes are limited to the most recently focused feed on a new tab and any feed the member explicitly opens. Cache selectors include the current community selection and account where content is private, so persistence never crosses identities. This keeps the overview useful without restoring every-feed fetching on every new tab.

## Direction contract

**THESIS:** A community front page, not a tab strip or widget grid.

**OWN-WORLD:** Warm paper, editorial type, quiet rules, community provenance, and forest-green action. Decorative feed-color bars are absent; civic state supplies emphasis.

**STORY:** Scan four community signals, choose one, read deeply, return.

**FIRST VIEWPORT:** A quieted top bar and sidebar frame a gapless 2×2 editorial mosaic. Every tile uses its available height for a calm, complete-row preview, with civic urgency and provenance visible inside each row. Customize is quiet but visible.

**FORM:** Adaptive almanac front page, shaped directly inside the established world.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Interaction and hardening

- Actionable civic states such as Needs your response, Happening now, and Open to join outrank passive content without changing the user's tile order.
- Customize replaces item opening with 44px reorder controls, visible instructions, an Auto-fit or exact-count selector per tile, and Reset layout. Reorders remain announced to assistive technology.
- Preview depth is presentation-only: it never triggers pagination or additional source requests. Exact counts that exceed the current tile height scroll inside that tile; Auto-fit never introduces tile scrolling or a clipped final row.
- Signed-out, empty, and error tiles explain the next action; opening them leads directly to the existing connection, sign-in, or retry surface.
- The dashboard subordinates tab-search chrome while leaving it available and preserving the `/` shortcut. The Collections sidebar retains its established width; visual quieting must not compress or newly truncate collection names.
- Narrow layouts retain guidance, use one column, and scroll; focused feeds keep their existing controls and scrolling.
