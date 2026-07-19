---
date: 2026-07-18
status: built
initiative: Unified Community Input Surface (#39), Sub-project C (#3)
repos: [my-community]
---

# Suggest a page to the community wiki queue — design

The ingestion half of the knowledge loop (E renders + votes; C submits). A member
sends the current page to a community's `wiki_queue`, where it surfaces as a
knowledge card (E) and gets voted toward the wiki.

## Mechanism: toolbar target + dedicated shortcut (confirmed 2026-07-18)

Context menu was considered and rejected. Two triggers instead:

- **Toolbar button**: opt-in via its existing target setting. Save Behavior gains a
  third option, "Community wiki queue"; when selected, a toolbar click suggests the
  current page instead of save-and-close. Default stays "Saved Tabs" (unchanged for
  existing users). Alt+S is untouched (still saves to a collection).
- **New keyboard shortcut** `suggest-to-wiki` (default `Alt+Shift+S`, rebindable at
  `chrome://extensions/shortcuts`): always suggests the current page, regardless of
  the toolbar setting.

Community resolution: a toolbar click / keypress can't show a picker, so suggestions
go to a **single default community**, set in Save Behavior ("Suggest sources to").
Resolver (in the worker): the explicit setting if it still matches a selected
community; else the sole selected community; else none (badge hint to pick one).

## The MV3 constraint + enabling move

The page to suggest is a different tab than the new-tab UI, so the action runs in the
service worker (`public/background.js`), which cannot read the page's `localStorage`
(where the CA session lives). Mirror two things page -> `chrome.storage.local` (same
extension-private trust boundary, no new exposure):

- `mc_ca_session_bg`: CA Bearer token (write-through in `store/caAuth.js` at every
  session set/clear; `caSessionHeader()` is just `Bearer <mc_ca_session>`).
- `mc_communities_bg`: the member's selected communities `[{id,name}]` (effect in
  `app.jsx` on `selectedCommunities`).

Plus the setting `mc_wiki_suggest_community` `{id,name}` written by SettingsModal.

## Service worker (`public/background.js`)

- `suggestToWiki(tab)`: skip `chrome://` / `chrome-extension://`; read the three keys;
  resolve the community; if no token or no community, flash a badge hint and stop.
  `POST {CA}/communities/<id>/wiki/queue` with `{url, title, source:'browser'}` and
  `Authorization: Bearer <token>`. Badge: 201 -> ✓ green; 409 (already queued) -> =
  blue; 403 (not a member) -> ✗ red; else ✗. Does NOT close the tab. Sends
  `WIKI_QUEUE_CHANGED` so an open feed refreshes.
- `chrome.action.onClicked`: when the toolbar target is `wiki-queue`, call
  `suggestToWiki`; else the existing save-and-close.
- `chrome.commands.onCommand`: `suggest-to-wiki` -> `suggestToWiki(active tab)`.

## Manifest

Add the `suggest-to-wiki` command (`Alt+Shift+S`). No new permission (`contextMenus`
not needed after the pivot; CA host permission already present).

## Page side

- `app.jsx`: mirror `mc_communities_bg`; handle `WIKI_QUEUE_CHANGED` ->
  `refreshWikiQueue` (cache-busting reload so a just-suggested source appears).
- `store/knowledge.js`: `refreshWikiQueue` (clears the 90s cache, reloads).
- `SettingsModal.jsx`: "Community wiki queue" toolbar option + a "Suggest sources to"
  community picker (reuses the existing `topic-grid-chip` control) + a hint.

## Feedback

Toolbar action badge (✓ / = / ✗), consistent with the existing save gesture, no new
permission. Native notifications deferred (would add a permission prompt).

## Out of scope

- Per-suggestion community choice (dropped with the context menu; set-once default).
- Membership pre-check in the picker (a non-member pick 403s with a badge hint).
- Telegram auto-forward ingestion (Sub-project D / #4).
- Any community-admin change (the `wiki_queue` POST already exists).

## Verification

- `node --check` the worker; `npm run build` for the bundled changes; manifest JSON
  validated; 10 logic tests for the community resolver + badge mapping.
- Manual load-unpacked check required for the real trigger -> submit -> card-appears
  flow (no headless render for service-worker behavior).
