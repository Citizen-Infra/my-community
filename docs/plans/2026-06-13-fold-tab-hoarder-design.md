# Fold Tab Hoarder into My Community — design (sub-project A)

**Status:** design approved 2026-06-13 (Artem). Single-repo (my-community).
**Part of a larger initiative** (fold + wiki ingest from the browser/Telegram + community voting). This spec covers **only sub-project A: the fold + re-skin**. B/C/D/E are follow-on, see "Out of scope".

## Goal

One Chrome extension whose new-tab page is **My Community's dashboard *and* Tab Hoarder's full tab manager**, rendered entirely in My Community's visual system, carrying Tab Hoarder's existing save behaviors.

## Decisions

- **Full Tab Hoarder manager, rehoused** (collections, drag-and-drop, search, sort, import/export, bookmark import, backups, both save behaviors). Nothing dropped.
- **Dashboard leads.** Shell = Tab Hoarder's layout (left side panel + main grid); the **community dashboard is a pinned entry at the top of the side panel, above collections, and is the default view** on new-tab.
- **Re-skin to My Community's `DESIGN.md`** (forest-green / warm-paper / Instrument Serif + DM Sans). Drop Tab Hoarder's terracotta + Libre Baskerville.
- **Snapshot before merge** so the current My Community is recoverable.

## Design

### 1. Layout / IA
```
+----------------------------------------------+
|  My Community        [search]         (gear)  |
+--------------+-------------------------------+
| > Dashboard  |  Dashboard selected (default):|
|   (pinned)   |    community feeds            |
| ------------ |    (Digest / Network /        |
| COLLECTIONS  |     Participation / Jam)       |
|  - Saved     |                               |
|  - Reading   |  Collection selected:         |
|  - Work      |    that collection's tab grid |
+--------------+-------------------------------+
```
Side panel: a pinned **Dashboard** entry, then the collections list. Main area renders the full community dashboard when Dashboard is selected (default), or the active collection's tab grid when a collection is selected. Tab Hoarder's TopBar (brand, search, gear) is the shared chrome.

### 2. Code merge
Both apps are **Preact + @preact/signals + Vite** (low-friction merge). Port Tab Hoarder's `store/` (collections, tabs, search, sort, backup, settings), `components/` (Sidebar, MainContent/tab grid, TabCard, drag-and-drop hook, import/export modals, SettingsPanel save-behavior section), and `lib/` into My Community.
- **Resolve the store name collision:** My Community's `store/tabs.js` is *dashboard panel visibility*; Tab Hoarder's `store/tabs.js` is *browser tabs*. Rename My Community's to `store/panels.js` (update `tabs.js` references in `TabBar`, `App`).
- **Merge the two `background.js` service workers** into one (My Community has a worker; Tab Hoarder's holds the save-and-close + restore + daily-backup logic). Keep it dependency-free and raw-IndexedDB per Tab Hoarder's constraint.

### 3. Manifest
Add to My Community's `manifest.json`: `action` (toolbar "Save & close tab"), `commands` (`save-to-recent` = Alt+S), and permissions `alarms` + `downloads` + `bookmarks` (on top of existing `tabs` + `storage`). Keep My Community's `host_permissions` and `chrome_url_overrides.newtab`. **New permissions force a re-approval prompt** on the next update; call this out in the release notes.

### 4. Data layers (coexist, no conflict)
- Tab data: **IndexedDB** (`tab-hoarder` db: collections + tabs) + `chrome.storage.local` backup + daily file backup.
- Feeds: **Supabase / ATproto** + `mc_*` localStorage. Untouched.
Both backup systems stay. No shared schema.

### 5. Re-skin
Tab Hoarder UI adopts My Community's `variables.css` tokens and `DESIGN.md` rules (Green-Led, Serif-for-Voice, Community-Color, Warm-Shadow). Replace Tab Hoarder's accent palette + fonts; reuse My Community's card / chip / button treatments so collections and tab cards match the digest cards.

### 6. Settings
Fold Tab Hoarder's **Save Behavior** section (toolbar target + Alt+S target) into My Community's existing `SettingsModal`, in the My Community settings visual style.

### Extensibility hook (for B/E)
Keep the dashboard's feed set **data-driven / extensible** (not a hardcoded switch), so the future **"Wiki" feed** (recently-added articles + Polis-style "should we process this?" voting, sub-project E) slots in without reopening A.

## Out of scope (follow-on)
- **B** — wiki ingest + curation backbone (scenius-digest queue + vote model + DDS spike).
- **C** — browser "Send to wiki queue" toolbar action + 3rd save behavior.
- **D** — "wiki ingestion" Telegram group auto-forward.
- **E** — dashboard "Wiki" feed (recently-added + Polis-style queue voting); front-end of B; the DDS exploration lives here.

## Safety (implementation step 1, non-negotiable)
Before any merge: `git tag v0.1.4-pre-merge` and push a `pre-tab-hoarder` branch to GitHub, so today's My Community is one `git checkout` away.

## Build order (high level)
1. Snapshot (tag + branch, pushed).
2. Scaffold the merged shell: side panel with pinned Dashboard entry + collections, main-area swap (dashboard ⇄ collection grid), default = Dashboard.
3. Port Tab Hoarder stores/components/lib (with the `panels.js` rename).
4. Merge the two service workers; wire manifest `action` + `commands` + permissions.
5. Re-skin to DESIGN.md.
6. Fold Save Behavior into SettingsModal.
7. `npm run build`, load unpacked, verify both surfaces + save behaviors.
