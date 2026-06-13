# Fold Tab Hoarder into My Community — Implementation Plan (sub-project A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Tab Hoarder's full tab manager into My Community as one Chrome extension, with My Community's dashboard pinned at the top of Tab Hoarder's side panel (default view), all re-skinned to My Community's `DESIGN.md`.

**Architecture:** Both apps are Preact + @preact/signals + Vite. Tab Hoarder's source (stores, components, lib, hooks, IndexedDB layer, service-worker save logic) is ported into `my-community/extension/`. A top-level `activeView` signal swaps the main area between the existing My Community dashboard (default) and the active collection's tab grid. One merged `background.js` service worker carries the save-and-close behaviors.

**Tech Stack:** Preact, @preact/signals, Vite (`base: ''`), Chrome MV3, IndexedDB (`idb` in app context, raw in worker), `chrome.storage.local`.

**Spec:** `my-community/docs/plans/2026-06-13-fold-tab-hoarder-design.md`. **Design context:** `my-community/PRODUCT.md` + `DESIGN.md`.

**No test framework exists** in either repo. Per-task verification = `npm --prefix extension run build` (catches import/syntax/JSX errors) plus, for functional tasks, **load unpacked** at `chrome://extensions` (Developer mode → Load unpacked → `extension/dist/`) and run the stated manual checks.

---

## File structure (my-community/extension/)

- **Snapshot only:** git tag `v0.1.4-pre-merge`, branch `pre-tab-hoarder`.
- **Rename:** `src/store/tabs.js` → `src/store/panels.js` (My Community's dashboard-panel-visibility store; frees the `tabs.js` name for Tab Hoarder's browser-tabs store).
- **Port in (from `tab-hoarder/src/`):** `store/{db,collections,tabs,search,sort,backup}.js`, `store/settings.js` → `store/saveSettings.js`, `lib/{id,favicon,export,toby-import}.js`, `hooks/useDragAndDrop.js`, `components/{Sidebar,TabCard,MainContent,ImportModal,BookmarkImportModal,ConfirmDialog}.jsx`, the tab-manager CSS (`styles/*`).
- **Rewrite:** `src/app.jsx` (the merged shell), `public/background.js` (merge worker), `public/manifest.json` (action + commands + permissions), `src/components/SettingsModal.jsx` (add Save Behavior), `src/components/TopBar.jsx` (add search box).
- **New:** `src/components/Dashboard.jsx` (extracts today's feeds view so the shell can swap it).

---

### Task 1: Snapshot the current My Community (safety, non-negotiable)

**Files:** none (git only).

- [ ] **Step 1: Tag and branch the current state**

```bash
git -C /c/Users/temaz/claude-project/my-community tag v0.1.4-pre-merge
git -C /c/Users/temaz/claude-project/my-community branch pre-tab-hoarder
git -C /c/Users/temaz/claude-project/my-community push origin v0.1.4-pre-merge pre-tab-hoarder
```

- [ ] **Step 2: Verify both exist on origin**

Run: `git -C /c/Users/temaz/claude-project/my-community ls-remote --tags --heads origin | grep -E "v0.1.4-pre-merge|pre-tab-hoarder"`
Expected: both refs listed. The current My Community is now recoverable with `git checkout v0.1.4-pre-merge`.

- [ ] **Step 3: Create the working branch**

```bash
git -C /c/Users/temaz/claude-project/my-community checkout -b fold-tab-hoarder master
```

---

### Task 2: Rename My Community's `tabs.js` → `panels.js`

Frees the `tabs.js` name. My Community's `store/tabs.js` controls dashboard **feed visibility** + active feed; it is unrelated to browser tabs.

**Files:**
- Rename: `src/store/tabs.js` → `src/store/panels.js`
- Modify: every importer of `store/tabs` (at least `src/components/TabBar.jsx`, `src/app.jsx`)

- [ ] **Step 1: Rename the file**

```bash
git -C /c/Users/temaz/claude-project/my-community/extension mv src/store/tabs.js src/store/panels.js
```

- [ ] **Step 2: Update every import**

Find them: `grep -rn "store/tabs'" /c/Users/temaz/claude-project/my-community/extension/src`. In each hit, change `from '../store/tabs'` / `'./store/tabs'` to `.../store/panels`. Do **not** rename the exported signal names or the `mc_visible_tabs` / `mc_active_tab` localStorage keys (keeps existing user prefs intact).

- [ ] **Step 3: Build to verify no broken imports**

Run: `npm --prefix /c/Users/temaz/claude-project/my-community/extension run build`
Expected: build succeeds. (A missed import throws "failed to resolve import".)

- [ ] **Step 4: Commit**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Rename dashboard tabs store to panels (frees tabs.js for browser tabs)"
```

---

### Task 3: Port Tab Hoarder's data layer (no UI yet)

**Files (copy from `tab-hoarder/src/` to `my-community/extension/src/`):**
- Create: `src/store/db.js`, `src/store/collections.js`, `src/store/tabs.js`, `src/store/search.js`, `src/store/sort.js`, `src/store/backup.js`
- Create: `src/store/saveSettings.js` (from Tab Hoarder `store/settings.js`, renamed to avoid confusion with My Community settings)
- Create: `src/lib/id.js`, `src/lib/favicon.js`, `src/lib/export.js`, `src/lib/toby-import.js`
- Create: `src/hooks/useDragAndDrop.js`

- [ ] **Step 1: Copy the modules**

Copy each file listed above verbatim from `tab-hoarder/src/...` to the matching `my-community/extension/src/...` path. In the copied `store/tabs.js`, confirm it imports `idb` and `./db` (Tab Hoarder's tab store), not My Community's renamed panels store. In `saveSettings.js`, rename any exported `settingsOpen`/`theme`/`accent` signals that would clash with My Community's theme store (My Community already owns `store/theme.js`); keep only the **save-target** settings (`tab-hoarder-toolbar-target`, `tab-hoarder-shortcut-target`, backup toggles) here, and delete the theme/accent bits (My Community's theme wins per DESIGN.md "One identity, adopted inward").

- [ ] **Step 2: Confirm `idb` is a dependency**

Run: `grep '"idb"' /c/Users/temaz/claude-project/my-community/extension/package.json || echo MISSING`
If MISSING: `npm --prefix /c/Users/temaz/claude-project/my-community/extension install idb` (Tab Hoarder uses it for the app-context IndexedDB wrapper).

- [ ] **Step 3: Build (modules compile even though unused)**

Run: `npm --prefix /c/Users/temaz/claude-project/my-community/extension run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Port Tab Hoarder data layer (IndexedDB stores, lib, drag-drop hook)"
```

---

### Task 4: Port Tab Hoarder's tab-manager components + styles (no wiring yet)

**Files:**
- Create: `src/components/Sidebar.jsx`, `src/components/TabCard.jsx`, `src/components/MainContent.jsx`, `src/components/ImportModal.jsx`, `src/components/BookmarkImportModal.jsx`, `src/components/ConfirmDialog.jsx`
- Create: the Tab Hoarder tab-manager CSS files under `src/styles/` (e.g. `sidebar.css`, `tabgrid.css`, `tabcard.css` — match Tab Hoarder's actual filenames)

- [ ] **Step 1: Copy the components and CSS**

Copy each component verbatim from `tab-hoarder/src/components/...`. Fix import paths so they resolve in My Community's tree (stores/lib/hooks now live at the same relative paths from Task 3). Copy the corresponding CSS files and add their `@import` (or `import './styles/x.css'`) wherever My Community aggregates styles (check `src/newtab.html` / the entry for how My Community loads CSS, and mirror it).

- [ ] **Step 2: Build**

Run: `npm --prefix /c/Users/temaz/claude-project/my-community/extension run build`
Expected: build succeeds (components compile though not yet rendered).

- [ ] **Step 3: Commit**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Port Tab Hoarder tab-manager components + styles"
```

---

### Task 5: Extract today's feeds into a `Dashboard` component

So the shell can swap the dashboard in and out of the main area.

**Files:**
- Create: `src/components/Dashboard.jsx`
- Modify: `src/app.jsx` (temporarily render `<Dashboard/>` in place of the inline feeds, to prove the extraction)

- [ ] **Step 1: Move the feeds markup**

Cut the current feeds region from `app.jsx` (the `TabBar` + `DigestFeed`/`BlueskyFeed`/`SessionsPanel`/`AvailsBanner`/`JamBanner` block) into a new `Dashboard.jsx` that renders exactly that. Keep all store imports (`panels`, `digest`, `bluesky`, `sessions`, `avails`, `jam`). `app.jsx` renders `<TopBar/>` + `<Dashboard/>` for now.

- [ ] **Step 2: Build + load + verify the dashboard is unchanged**

Run: `npm --prefix /c/Users/temaz/claude-project/my-community/extension run build`, then load unpacked and open a new tab.
Expected: the dashboard looks and behaves exactly as before (all feeds, the feed TabBar, settings gear). This task is a no-visible-change refactor.

- [ ] **Step 3: Commit**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Extract dashboard feeds into Dashboard component"
```

---

### Task 6: Build the merged shell (the keystone)

**Files:**
- Create: `src/store/view.js`
- Modify: `src/app.jsx`, `src/components/Sidebar.jsx`

- [ ] **Step 1: Add the view store**

Create `src/store/view.js`:

```js
import { signal } from '@preact/signals';

// 'dashboard' | <collectionId>
export const activeView = signal('dashboard');

export function showDashboard() { activeView.value = 'dashboard'; }
export function showCollection(id) { activeView.value = id; }
```

- [ ] **Step 2: Rewrite `app.jsx` as the shell**

```jsx
import { activeView } from './store/view';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import MainContent from './components/MainContent'; // Tab Hoarder's collection tab grid

export default function App() {
  return (
    <div class="app-shell">
      <TopBar />
      <div class="app-body">
        <Sidebar />
        <main class="app-main">
          {activeView.value === 'dashboard'
            ? <Dashboard />
            : <MainContent collectionId={activeView.value} />}
        </main>
      </div>
    </div>
  );
}
```

If `MainContent` reads the active collection from Tab Hoarder's `collections` store rather than a prop, set that store's `activeCollectionId` in `showCollection()` instead of passing `collectionId` — match Tab Hoarder's actual API (read `store/collections.js`).

- [ ] **Step 3: Add the pinned Dashboard entry to Sidebar**

In `Sidebar.jsx`, render a pinned **Dashboard** item at the very top (above the collections list) that calls `showDashboard()` and shows active when `activeView.value === 'dashboard'`; each collection row calls `showCollection(collection.id)` and shows active when it matches. Add a `.app-shell { display:flex; flex-direction:column; height:100vh }`, `.app-body { display:flex; flex:1; min-height:0 }`, `.app-main { flex:1; overflow:auto }` to a layout CSS file.

- [ ] **Step 4: Build + load + verify the swap**

Run the build, load unpacked, open a new tab.
Expected: side panel shows **Dashboard** (pinned, active by default) above collections; main area shows the dashboard. Clicking a collection swaps the main area to that collection's tab grid; clicking Dashboard swaps back. Default on a fresh new tab is the dashboard.

- [ ] **Step 5: Commit**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Merged shell: pinned Dashboard entry + collection tab grid in one new tab"
```

---

### Task 7: Update the manifest

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: Write the merged manifest**

```json
{
  "manifest_version": 3,
  "name": "My Community",
  "version": "0.2.0",
  "description": "Your new tab: a community dashboard and a tab manager — digests, network, participation, and your saved tabs.",
  "permissions": ["tabs", "storage", "alarms", "downloads", "bookmarks"],
  "host_permissions": [
    "https://eeidclmhfkndimghdyuq.supabase.co/*",
    "https://scenius-digest.vercel.app/*",
    "https://api.lu.ma/*",
    "https://*.bsky.network/*",
    "https://bsky.social/*",
    "https://navidrome-jam-production.up.railway.app/*",
    "https://avails.zhgnv.com/*"
  ],
  "background": { "service_worker": "background.js" },
  "chrome_url_overrides": { "newtab": "src/newtab.html" },
  "commands": {
    "save-to-recent": {
      "suggested_key": { "default": "Alt+S" },
      "description": "Save tab to most recent collection"
    }
  },
  "action": { "default_title": "Save & close tab" },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

(`action` reuses My Community's existing icons; no separate `default_icon` block needed.)

- [ ] **Step 2: Build + reload + verify**

Run the build, reload the unpacked extension.
Expected: a toolbar button appears (title "Save & close tab"); Chrome shows a permission-change prompt for the new `alarms`/`downloads`/`bookmarks` scopes (expected, note for release).

- [ ] **Step 3: Commit**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Manifest: add toolbar action, Alt+S command, alarms/downloads/bookmarks permissions; bump to 0.2.0"
```

---

### Task 8: Merge the service workers

**Files:**
- Modify: `public/background.js` (My Community's worker gains Tab Hoarder's save logic)

- [ ] **Step 1: Merge the handlers**

Into My Community's `public/background.js`, fold Tab Hoarder's `public/background.js` logic verbatim, keeping it dependency-free raw-IndexedDB (the Vite build copies `public/` as-is):
- `chrome.action.onClicked` → `saveAndCloseTab(tab, toolbarTarget)`
- `chrome.commands.onCommand` (`save-to-recent`) → `saveAndCloseTab(tab, shortcutTarget)`
- the `restoreIfEmpty()` call before a save, the `chrome.storage.local` mirror + badge confirmation, the `chrome.alarms` daily file backup, and first-run backup.
Preserve any existing My Community worker responsibilities. Keep the shared `saveAndCloseTab()` helper and the `DATA_CHANGED` message Tab Hoarder sends so open new-tab pages refresh.

- [ ] **Step 2: Reload + verify the save behaviors**

Reload the unpacked extension. On any normal web page:
- Click the toolbar button → the tab is saved to the configured collection and closes; badge confirms.
- Set Alt+S at `chrome://extensions/shortcuts`, press it on a page → saved to the most-recent collection.
Open a new tab → the saved tab appears in its collection.
Expected: all of the above work; no console errors in the service worker.

- [ ] **Step 3: Commit**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Merge service workers: toolbar + Alt+S save-and-close, backups"
```

---

### Task 9: Re-skin the tab manager to DESIGN.md

**Files:**
- Modify: the ported Tab Hoarder CSS files under `src/styles/`

- [ ] **Step 1: Map tokens to My Community's system**

In every ported Tab Hoarder style file, replace Tab Hoarder's tokens with My Community's `variables.css` tokens (My Community's `:root` already defines them):
- terracotta accent → `var(--color-primary)` (forest green); deep-accent → `var(--color-primary-hover)`
- Libre Baskerville → `var(--font-display)` (Instrument Serif); Inter → `var(--font-body)` (DM Sans)
- Tab Hoarder card backgrounds/borders/radii → `var(--color-surface)`, `var(--color-border-light)`, `var(--radius-md)`; hover shadow → `var(--shadow-card-hover)`
- delete Tab Hoarder's accent-color presets and its own `[data-theme]` block (My Community's theme store + variables own light/dark).

- [ ] **Step 2: Build + load + visually verify**

Reload, open a new tab, view a collection.
Expected: collections sidebar, tab cards, and modals read as the same warm-paper / forest-green / serif-display system as the dashboard's digest cards. No terracotta, no Libre Baskerville. Dark mode (toggle in settings) stays warm, not neon (DESIGN.md "Don't build a generic tech-dark tool").

- [ ] **Step 3: Commit**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Re-skin tab manager to My Community DESIGN.md (green/paper/serif)"
```

---

### Task 10: Fold Save Behavior into Settings; add TopBar search

**Files:**
- Modify: `src/components/SettingsModal.jsx`, `src/components/TopBar.jsx`

- [ ] **Step 1: Add the Save Behavior section to SettingsModal**

In My Community's `SettingsModal.jsx`, add a "Save Behavior" section (in My Community's settings style) with the two selects from Tab Hoarder — toolbar target and Alt+S (shortcut) target — bound to `store/saveSettings.js` (`tab-hoarder-toolbar-target`, `tab-hoarder-shortcut-target`). Include the "set the Alt+S shortcut at chrome://extensions/shortcuts" hint Tab Hoarder shows.

- [ ] **Step 2: Add search to TopBar**

Wire Tab Hoarder's search (`store/search.js`) into My Community's `TopBar.jsx` as a search input; when `searchQuery` is non-empty, `MainContent` shows grouped search results (Tab Hoarder's existing behavior). Empty query restores the normal view.

- [ ] **Step 3: Build + load + verify**

Reload. In Settings: the Save Behavior selects appear, persist across reloads, and change where toolbar/Alt+S save. Typing in the TopBar search filters tabs across collections.
Expected: both work; settings persist.

- [ ] **Step 4: Commit**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Settings: Save Behavior section; TopBar tab search"
```

---

### Task 11: Full verification, changelog, open PR

**Files:**
- Modify: `README.md` (changelog), `extension/package.json` (version 0.2.0 to match manifest)

- [ ] **Step 1: Full manual regression**

Build, load unpacked, and verify end to end:
- Dashboard is the default view; Digest / Network / Participation / Jam / Avails all load; the feed TabBar still toggles feeds.
- Collections: create, rename, reorder; tabs save, drag within and across collections, delete; search; import (Toby + Tab Hoarder JSON), bookmark import, export.
- Save behaviors: toolbar click + Alt+S, to the configured targets.
- Backups: `chrome.storage.local` mirror restores after clearing IndexedDB; daily file backup lands in `Downloads/`.
- Theme light/dark/system; communities selection still drives all feeds.
Expected: all pass; no console errors.

- [ ] **Step 2: Version + changelog**

Set `extension/package.json` `"version": "0.2.0"`. Add a `README.md` changelog entry for 0.2.0 noting the Tab Hoarder fold and the **new permissions (alarms, downloads, bookmarks) that trigger a re-approval prompt**.

- [ ] **Step 3: Commit, push, open PR**

```bash
git -C /c/Users/temaz/claude-project/my-community add -A
git -C /c/Users/temaz/claude-project/my-community commit -m "Tab Hoarder fold: version 0.2.0 + changelog"
git -C /c/Users/temaz/claude-project/my-community push -u origin fold-tab-hoarder
gh pr create -R Citizen-Infra/my-community --fill --head fold-tab-hoarder
```
Do **not** tag a release (`v*`) yet — that's a separate ship decision (it triggers the packaging workflow). Leave the PR for review/merge.

---

## Self-review

**Spec coverage:** Layout/IA → Task 6. Full manager rehoused → Tasks 3, 4, 6, 8, 10. Store-collision rename → Task 2. Service-worker merge → Task 8. Manifest (action/commands/permissions + re-approval note) → Tasks 7, 11. Two data layers coexist → Tasks 3, 8 (untouched My Community feeds). Re-skin → Task 9. Settings fold → Task 10. Extensibility hook (data-driven feed set for the future Wiki feed) → preserved by Task 5's `Dashboard` extraction (feeds are componentized, not hardcoded in the shell). Snapshot-first → Task 1. Out-of-scope B/C/D/E → not present. All spec sections covered.

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Component-port tasks reference exact source files and give transformation rules + a build/manual gate rather than reproducing source that must be read from the real Tab Hoarder files at execution time (this is a merge of existing code, not greenfield) — intentional and explicit, not a placeholder.

**Consistency:** `activeView` signal (`'dashboard' | collectionId`) defined in Task 6 and consumed there; `showDashboard()`/`showCollection()` named consistently across Tasks 6's app.jsx and Sidebar. `store/panels.js` (renamed) used everywhere My Community's old `tabs.js` was. `saveSettings.js` keys (`tab-hoarder-toolbar-target`/`-shortcut-target`) consistent across Tasks 3, 8, 10. Manifest version `0.2.0` consistent across Tasks 7 and 11.
