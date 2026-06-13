# Product

## Register

product

## Users

CIBC-ecosystem members and civically-engaged people who keep a browser open all day. Their context is the new-tab moment: the small pause between tasks when a fresh tab opens. They want that moment to surface what their community is doing rather than a blank page or a search box, and increasingly they want to *act* from there, save and organize the tabs they're working through, and (soon) push a link straight into the wiki ingestion queue. They are not necessarily technical; the core experience must work with no account and no setup.

## Product Purpose

My Community replaces the browser's new-tab page with a community dashboard: a curated digest, a Bluesky network feed, participation opportunities (events and sessions), and live jam rooms, scoped to the communities the user follows. It exists to make community activity ambient, present at a glance, every time a tab opens, so participation becomes a habit rather than a destination.

It is now growing a second capability: folding in the Tab Hoarder tab manager (collections, save-and-close, search) so the same surface that shows your community's pulse also holds your working tabs. The community dashboard leads; the tab manager is a power feature that serves it. Success looks like a new tab that a civically-minded person is glad to see many times a day, that quietly keeps them connected and organized, and that they would never swap back to the default.

## Brand Personality

Warm, civic, grounded. The voice is editorial and human, not corporate or techy, closer to a well-set community newspaper than a productivity SaaS. It feels calm and considered, never urgent or attention-extracting. Three words: warm, civic, grounded.

## Anti-references

- **Generic tech-dark tool** (neon-on-black, crypto/dev-tool default darkness).
- **Sterile SaaS dashboard** (cold gray cards, hero-metric tiles, corporate analytics).
- **Cluttered startpage** (widget-soup new-tab pages stuffed with feeds, weather, clocks).
- **Soulless bookmark manager** (a utilitarian tab/bookmark grid with no warmth or point of view, the thing Tab Hoarder itself tries not to be).

## Design Principles

- **Civic pulse first.** The community dashboard is the home; new surfaces (including the tab manager) serve it and never bury it.
- **One identity, adopted inward.** Folded-in features take on My Community's existing warm-editorial visual system; the host skin is never bent to match an incoming feature.
- **Calm density over widget-soup.** Show what matters at a glance with generous breathing room; resist the urge to cram every possible feed onto the page.
- **Local-first and private by default.** The core works with no account; tab data and preferences stay on the user's machine.
- **Degrade gracefully.** Every feed and feature stays usable when a data source is unavailable or auth is absent, as the existing feeds already do.

## Accessibility & Inclusion

Target WCAG 2.1 AA contrast in both light and dark themes (light / dark / system, already supported). Respect `prefers-reduced-motion` for all card and feed animations. Keep interactive targets keyboard-reachable and large enough for non-precise pointers. Don't rely on color alone to convey state (e.g., session active/upcoming/completed should carry a non-color cue too).
