# MC clarity cluster: onboarding, filter legibility, tab privacy (#25 / #26 / #27)

**Issues:** Citizen-Infra/my-community #25, #26, #27 (from the veteran-engineer MC review)
**Status:** Design brief, shaped via impeccable 2026-07-12
**Register:** product · **Design system:** DESIGN.md ("The Community Almanac")

## 1. Feature summary

Three clarity fixes that make MC's implicit model legible to a non-technical first-run user: what's private vs. community, why the Network feed shows what it shows, and the difference between the two Bluesky sign-ins. No new capability, just comprehension. Shipped as three sequenced PRs: **#27 (tab-privacy label) -> #26 (filter chips) -> #25 (onboarding card)**, small to large.

## 2. Primary user action

Understand, within the first minute, what to do next and what each sign-in is for, without leaving the dashboard or hunting for a README.

## 3. Design direction

Inherited wholesale from DESIGN.md: color strategy **Restrained** (warm paper `#f8f6f1`, forest-green `#2d6a4f` led, amber rationed), light-warm theme, Instrument Serif for the single display heading, DM Sans for everything operable. Reuse the existing card, chip (pill + label type), ghost-button, and toggle components. No new visual vocabulary. Anchors: a community newspaper's masthead + standfirst; an almanac's "how to read this" caption.

## 4. Scope

Production-ready · three surfaces · shipped interactive components · polish-to-ship · three PRs sequenced small->large.

## 5. Layout strategy (per surface)

- **#27 tab-privacy note** — a quiet persistent affordance on the tab-manager surface (near the collection header): a Lucide device/lock icon + one `ink-muted` meta line. Not a card, not a banner. A printed caption.
- **#26 filter row** — a single chip row at the top of the Network feed, replacing the current stray window buttons. Reads left-to-right as the active rule; each chip is its control.
- **#25 onboarding card** — one standard card at the top of the dashboard, above the feed (surface-white on paper, 24px pad, 12px radius, gentle `card-enter`). Serif heading + three DM Sans checklist rows. Non-blocking: the dashboard is live underneath.

## 6. Key states

- **#27:** shown on every tab-manager view (has-tabs and empty alike).
- **#26:** connected+posts -> chips shown; connected+empty -> chips still shown (so the user can widen the window to fix "nothing here"); not-connected -> no chips (the #25 connect prompt takes over).
- **#25:** each step's check is **derived from real state** (signed in? communities chosen? Bluesky connected?), never a fake done. Card auto-hides once all three are done; dismissible early via the close control; re-openable from a Help link.

## 7. Interaction model

- **#27:** static; an optional info tooltip expands one more sentence.
- **#26:** click a chip -> its own inline control (dropdown or toggle); the change applies immediately (reuses `setBluesky*` + `loadBlueskyFeed`). No modal trip. The Settings feed/reposts/sort controls are removed (see the #26 detail below).
- **#25:** each row's action deep-links to the right place (Sign in -> account; Choose communities -> the communities picker; Connect Bluesky -> the Network tab's connect). Close dismisses; "Getting started" reappears from the gear/Help.

## 8. Content requirements (MC voice, no em dashes)

- **Onboarding card** heading (serif): *"Set up your dashboard."*
  1. **Sign in to your community account** — "Email or Bluesky. This is your identity across communities, and it unlocks private ones."
  2. **Choose your communities** — "Pick whose pulse you want on every new tab."
  3. **Connect Bluesky for the Network feed** — "Optional. Only the Network feed needs it. Your digest and events work without signing in."
  - Fourth muted line: "Your saved tabs stay private to you, only on this device."
- **The two-door distinction** (wherever each appears):
  - Community account: *"Community account, email or Bluesky. Unlocks private communities."*
  - Network connect: *"Connect Bluesky, powers your Network feed (posts from people you follow). Separate from your community account."*
- **#27 privacy line:** *"Only on this device. Not visible to your community."*
- **#26 chip row:** `Following · past 24h · reposts on · top by engagement`, each segment an editable chip. Optional muted lead-in "Showing:".
- **Help link** from the gear -> the GitHub README/guide (exact URL at build; the point is the UI stops being a dead end for `.zip` users).

## #26 detail: exact control mapping (verified against SettingsModal.jsx:298-350)

The chip row must faithfully mirror the four real filters; the Settings cleanup is surgical, not a block delete.

| Control | Today | Chip form |
|---|---|---|
| Feed source | Settings `<select>`, **rendered only when `blueskyAvailableFeeds.length > 1`**; options are Following + feed generators + `List: <name>` | Chip -> dropdown, **shown only when >1 feed exists** (Following-only users get a static "Following" or no chip); the dropdown reproduces the `List:`/feed naming |
| Time window | Feed buttons (24h / 7d / 30d) | Chip -> 3-way |
| Show reposts | Settings toggle (`blueskyShowReposts`) | Chip -> toggle |
| Sort (weighted engagement) | Settings toggle (`blueskyWeightedSort`); it is a **boolean** (likes <-> weighted), not a menu | Chip -> binary flip |

**Stays put (NOT a filter):** the **Network tab-visibility toggle** (`visibleTabs.network` / `setTabVisible('network', ...)`) remains in Settings with the other tab toggles. The not-connected hint stays too. Only the inner `settings-card` (feed + reposts + sort, SettingsModal.jsx:299-350) is removed. **Disconnect** stays at the feed (identity action, not a filter).

## 9. Recommended references (for craft)

`onboard.md` (first-run card + derived-state steps), `clarify.md` (all the microcopy above), `interaction-design.md` (the inline chip dropdowns).

## 10. Open questions (resolve during build)

- #27 note anchor: collection header vs. a persistent sidebar footer — pick against the real layout during craft.
- Help link target: GitHub README now, or a short hosted guide later (README fine for v1).
- #25 "Sign in" step: open the account modal directly vs. scroll to it — pick the lower-friction one against the real component.
