---
name: My Community
description: A warm, editorial community dashboard that replaces the browser new tab.
colors:
  forest-green: "#2d6a4f"
  forest-green-deep: "#1b4d3e"
  amber: "#d97706"
  amber-deep: "#b45309"
  paper: "#f8f6f1"
  surface: "#ffffff"
  surface-hover: "#f3f1ec"
  ink: "#1c1917"
  ink-soft: "#57534e"
  ink-muted: "#a8a29e"
  border: "#ddd9d0"
  border-light: "#eceae4"
  slate-blue: "#457b9d"
  danger: "#dc2626"
typography:
  display:
    fontFamily: "Instrument Serif, Georgia, serif"
    fontSize: "clamp(1.6rem, 3vw, 2.4rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "normal"
  body:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.5px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  full: "100px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "36px"
  xxl: "56px"
components:
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px"
  chip-community:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
    typography: "{typography.label}"
  link:
    textColor: "{colors.forest-green}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
---

# Design System: My Community

## 1. Overview

**Creative North Star: "The Community Almanac"**

My Community reads like a warm, well-set almanac of a community's week, opened fresh every time a browser tab appears. It is editorial before it is software: a single narrow column of considered entries on warm paper, set in a serif display face, with a quiet forest-green voice running through it. The mood is calm and human, the opposite of a feed fighting for attention. Depth comes from warmth and restraint, not chrome.

The system is green-led and paper-bright. Forest green carries identity and action; amber is a rare second accent for emphasis; everything else is warm neutral. Type does the hierarchy: an Instrument Serif display for moments that deserve a voice, DM Sans for everything you actually operate. Motion is small and gentle, a soft upward settle as cards arrive, a two-pixel lift on hover.

It explicitly rejects the **generic tech-dark tool** (neon on black), the **sterile SaaS dashboard** (cold gray cards and hero-metric tiles), the **cluttered startpage** (widget-soup of feeds, weather, and clocks), and the **soulless bookmark manager** (a utilitarian grid with no point of view). When the Tab Hoarder manager folds in, it adopts this skin entirely; the host is never bent to match an incoming feature.

**Key Characteristics:**
- Warm paper background, never pure white or gray.
- Forest-green primary, amber accent used sparingly.
- Editorial serif display + humanist sans body.
- One narrow reading column (~720px), generous breathing room.
- Near-flat cards that lift gently on hover; warm, diffuse shadows.

## 2. Colors

A warm, low-chroma neutral field with one confident green and one rationed amber.

### Primary
- **Forest Green** (`#2d6a4f`, hover `#1b4d3e`): the brand voice. Links, primary actions, active/selected state, and the default community accent bar. In dark mode it brightens to a living green (`#4ade80`).

### Secondary
- **Harvest Amber** (`#d97706`, hover `#b45309`): emphasis only, highlights, attention badges, the occasional warm flourish. Never the dominant color on a surface.

### Tertiary
- **Slate Blue** (`#457b9d`): reserved for "upcoming" session/event state, a calm informational cue distinct from green's "active".

### Neutral
- **Warm Paper** (`#f8f6f1`): the page background. The whole product sits on this; it is what makes the system feel like print, not an app.
- **Surface White** (`#ffffff`): card and panel fill, raised one step above paper.
- **Ink** (`#1c1917`): primary text, a warm near-black, never `#000`.
- **Ink Soft** (`#57534e`) / **Ink Muted** (`#a8a29e`): secondary and tertiary text, metadata, captions.
- **Border** (`#ddd9d0`) / **Border Light** (`#eceae4`): hairline dividers and card edges.

### Named Rules
**The Green-Led Rule.** Forest green is the only primary voice. Amber is a second accent for emphasis and is forbidden from carrying more surface than green. The background is warm paper, never pure white and never gray.

**The Community-Color Rule.** The 4px left accent bar on a card encodes that item's community identity (`var(--community-border)`), and is the system's *only* sanctioned colored side-stripe. It is semantic, never decoration. No other element may use a `border-left`/`border-right` greater than 1px as a colored accent.

## 3. Typography

**Display Font:** Instrument Serif (with Georgia, serif fallback)
**Body Font:** DM Sans (with system-sans fallback)

**Character:** A high-contrast editorial serif for voice paired with a warm, geometric-humanist sans for operation. The serif gives the page a printed, considered feeling; the sans keeps every control legible at small sizes.

### Hierarchy
- **Display** (Instrument Serif, 400, clamp ~1.6–2.4rem, line-height 1.1): section/brand headings, the editorial moments. Carries voice, never used for UI controls.
- **Title** (DM Sans, 600, 15px, line-height 1.4, letter-spacing -0.01em): card titles, the primary scannable text in a feed entry.
- **Body** (DM Sans, 400, 14px base, line-height 1.6): descriptions and reading text. Hold the reading column near 65–75ch.
- **Label** (DM Sans, 600, 11px, letter-spacing 0.5px, uppercase): community badges and small categorical chips.
- **Meta** (DM Sans, 500, 12px, ink-muted; italic for sharer attribution): footers, domains, "via @user".

### Named Rules
**The Serif-for-Voice Rule.** Instrument Serif is reserved for display and brand moments. Body text, labels, buttons, and inputs are always DM Sans. A serif button is forbidden.

## 4. Elevation

Surfaces are nearly flat at rest and use warm, diffuse shadows that lift on interaction. Depth is a response to state, not a permanent decoration. Shadows are tinted warm (`rgba(28, 25, 23, ...)`), never neutral black.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 4px rgba(28,25,23,0.04)`): the resting state of a card. Barely there.
- **Card Hover** (`0 6px 20px rgba(28,25,23,0.08), 0 2px 6px rgba(28,25,23,0.03)`): paired with a `translateY(-2px)` lift on hover.
- **Small / Medium / Large** (`--shadow-sm/md/lg`): for popovers, the settings modal, and raised menus, in increasing diffusion.

### Named Rules
**The Warm-Shadow Rule.** Every shadow tints toward the ink hue and stays diffuse. A hard, dark, tight drop-shadow reads as a 2014 app and is prohibited. Dark mode swaps to soft black shadows but keeps the same near-flat-at-rest posture.

## 5. Components

### Buttons
- **Shape:** pill or soft (radius-full `100px` for inline actions; `md` 12px for blocky buttons).
- **Primary:** forest-green fill or green text on transparent, depending on weight; reserved for the main action.
- **Ghost / inline action:** transparent with muted text, revealing a tinted background and border on hover (the digest "Share to Bluesky" pill is the canonical example: hidden until card-hover, then slides in). Quiet by default, alive on hover.
- **Hover / Focus:** color shift to the deeper green/amber, a subtle scale or translate, transitions on the `--ease-out` curve (`cubic-bezier(0.16,1,0.3,1)`). Active state compresses slightly (`scale(0.96)`).

### Chips
- **Community badge:** uppercase 11px/600, pill (radius-full), tinted by the community's own color; on card-hover it inverts to a filled community-color chip with white text.
- **Topic chip:** smaller, paper-filled, muted text, hairline border. Categorical, not interactive.

### Cards / Containers
- **Corner Style:** 12px (radius-md); thumbnails 8px (radius-sm).
- **Background:** surface white on warm paper.
- **Shadow Strategy:** resting `--shadow-card`, hover `--shadow-card-hover` with a 2px lift (see Elevation).
- **Border:** 1px `border-light` at rest, darkening to `border` on hover.
- **Signature:** a 4px left accent bar carrying community color (the Community-Color Rule), widening to 5px on hover. Cards stagger in with `card-enter` (opacity + 12px rise, 40ms cascade).
- **Internal Padding:** `lg` (24px). No nested cards.

### Inputs / Fields
- **Style:** surface or paper fill, 1px border, `sm`/`md` radius, DM Sans at body size.
- **Focus:** border shifts to forest green with a soft green-subtle ring; no harsh blue browser outline.

### Navigation
- **Top bar** (72px): brand in Instrument Serif on the left, a settings gear on the right; quiet, no heavy chrome.
- **Tab bar:** horizontal text tabs for switching feeds (Digest / Network / Participation), active tab marked by green, not a heavy pill.

## 6. Do's and Don'ts

### Do:
- **Do** sit everything on warm paper (`#f8f6f1`); raise cards to surface white above it.
- **Do** keep forest green (`#2d6a4f`) as the single primary voice and ration amber (`#d97706`) to genuine emphasis.
- **Do** use Instrument Serif only for display/brand moments; DM Sans for all controls and reading text.
- **Do** keep one narrow reading column (~720px) with generous spacing; let entries breathe.
- **Do** keep cards near-flat at rest and lift them gently (`translateY(-2px)`, warm diffuse shadow) on hover.
- **Do** reserve the 4px left accent bar for community identity, and re-skin folded-in features (Tab Hoarder) into this exact system.

### Don't:
- **Don't** build a **generic tech-dark tool**: no neon-on-black, no electric accents. Dark mode is warm near-black (`#151311`) with the same green/amber.
- **Don't** build a **sterile SaaS dashboard**: no cold gray cards, no hero-metric tiles, no big-number-small-label template.
- **Don't** build a **cluttered startpage**: no widget-soup of weather, clocks, and stacked feeds competing for attention.
- **Don't** build a **soulless bookmark manager**: a bare utilitarian tab grid with no warmth or point of view is exactly what the Tab Hoarder fold must avoid.
- **Don't** use pure `#000` or `#fff`, hard tight black shadows, gradient text, or glassmorphism.
- **Don't** add any colored `border-left`/`border-right` over 1px except the sanctioned community accent bar.
