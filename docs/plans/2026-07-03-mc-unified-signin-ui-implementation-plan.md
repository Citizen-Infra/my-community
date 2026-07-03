# MC Unified Sign-in UI Implementation Plan (subsystem C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Render the two-door community account (email and Bluesky as equals), fold the Bluesky feed connection into the same OAuth sign-in, move the standalone feed connect to the feed itself, rename the tab to Network, and prompt legacy app-password users to reconnect.

**Architecture:** UI-only, on top of subsystem B's store/lib. `SettingsModal.jsx` gets the two-door account; the standalone app-password Bluesky box is removed; the Bluesky feed connect becomes a contextual affordance in the Network feed's empty state; `TabBar.jsx` renames the label. All visual work goes through the `impeccable` skill (MC has `PRODUCT.md` + `DESIGN.md`).

**Tech Stack:** Preact + @preact/signals, existing settings/auth CSS. No test framework: `cd extension && npm run build` + `[Human]` smoke.

## Global Constraints

- **Use the `impeccable` skill for every visible change here** (`craft`/`polish`). Reuse the existing classes (`settings-section`, `settings-card`, `settings-card-empty`, `settings-card-header`, `settings-card-status`, `status-dot`, `settings-link-btn`, `settings-card-desc`, `auth-form-compact`, `auth-input`, `auth-error`, `auth-submit`, `settings-hint`); do not hardcode colors/fonts. The one new CSS rule allowed is the email-fallback disclosure from #19 (`.settings-email-fallback`), if reused.
- **Only-one-Bluesky-affordance-at-a-time principle:** signed out -> two doors (email + Bluesky) in the account; signed in with Bluesky -> feed already on, no connect anywhere; signed in with email -> a "Connect Bluesky for your feed" affordance appears ONLY at the Network feed, never a second account control.
- **Exact copy** (no em dashes): account doors "Sign in with email" / "Sign in with Bluesky"; feed connect "Connect Bluesky to see popular posts from your network"; tab label "Network"; legacy prompt "Reconnect Bluesky to restore your feed".
- Depends on subsystem B (store/lib) being merged. No AI attribution in commits.
- **Branch:** `feat/mc-unified-signin-ui` off `master`.

---

### Task 1: Rename the tab to Network

**Files:**
- Modify: `extension/src/components/TabBar.jsx:5`

- [ ] **Step 1:** change `network: 'Bluesky',` to `network: 'Network',` in `TAB_LABELS`.
- [ ] **Step 2:** `cd extension && npm run build`.
- [ ] **Step 3:** Commit — `git add extension/src/components/TabBar.jsx && git commit -m "feat: rename Bluesky tab to Network"`

---

### Task 2: Two-door community account + remove the app-password box

**Files:**
- Modify: `extension/src/components/SettingsModal.jsx` (Community account section; remove the Bluesky app-password connect form; keep the Bluesky feed-prefs card gated on `isConnected`)

**Interfaces (Consumes from B):**
- `caSubject`, `caType`, `caSignedIn`, `requestSignIn`, `requestBlueskySignIn`, `signOut` (`store/caAuth`); `blueskyUser`, `isConnected`, `connectBluesky`, `disconnectBluesky` (`store/auth`).

**Design (hand to impeccable as the shape brief):**
- **Community account, signed out:** two equal `auth-submit` doors, "Sign in with email" (the existing `caEmailInput` + `requestSignIn` magic-link form) and "Sign in with Bluesky". They are peers, side by side or stacked with equal weight, NOT primary/fallback. The Bluesky door: if `isConnected.value`, a one-click "Sign in as @{handle}" (reuses the live OAuth session); else a handle input then the button.
- **Community account, signed in:** the identity card (`caIdentityLabel()` from #19: friendly handle for a Bluesky DID that matches `blueskyUser`, else the DID; email for an email identity) + "Sign out".
- **The Bluesky app-password connect form is removed entirely.** The Bluesky feed-prefs card (feed picker, reposts, weighted sort, tab toggle) stays, but only when `isConnected.value` (an OAuth session exists). When not connected, the old "Connect ... app password" empty card is gone; connecting the feed now lives at the Network feed (Task 3).

**Handlers (exact):**

```js
async function handleAccountBlueskySignIn(e) {
  if (e) e.preventDefault();
  setCaError(null);
  try {
    if (!isConnected.value) {
      const h = caHandleInput.trim();
      if (!h) { setCaError('Enter your Bluesky handle.'); return; }
      await connectBluesky(h);            // OAuth login (also lights the feed)
    }
    await requestBlueskySignIn();          // getServiceAuth -> /auth/atproto/assert
    await loadCommunities();
    if (selectedCommunityIds.value.length > 0) { loadDigest(selectedCommunityIds.value); loadSessions(selectedCommunities.value); }
  } catch (err) { setCaError(err.message); }
}
```

(`connectBluesky` navigates via `launchWebAuthFlow`, which returns to the same page; no full-page redirect. Keep the existing `handleCaSignIn` email handler and `handleCaSignOut` unchanged.)

- [ ] **Step 1:** With `impeccable` (`craft`), rebuild the Community account `<section>` per the design above, wiring `handleAccountBlueskySignIn`, the email form, and the signed-in card. Remove the app-password Bluesky connect form; gate the Bluesky feed-prefs card on `isConnected.value`. Import `caType`, `requestBlueskySignIn`, `connectBluesky`; add `caHandleInput` state (as in #19).
- [ ] **Step 2:** `cd extension && npm run build`.
- [ ] **Step 3:** `[Human]` smoke (subsystem B live): signed out shows both doors; "Sign in with Bluesky" runs consent once and lands signed-in with feed + communities; email door still sends a link; sign out clears both.
- [ ] **Step 4:** `impeccable polish` the section (hierarchy, copy, no em dashes, matches the rest of Settings).
- [ ] **Step 5:** Commit — `git add extension/src/components/SettingsModal.jsx && git commit -m "feat: two-door community account, remove app-password box (impeccable)"`

---

### Task 3: Contextual "Connect Bluesky for your feed" at the Network feed

**Files:**
- Read then modify: `extension/src/components/BlueskyFeed.jsx` (the not-connected empty state)

**Interfaces (Consumes):** `isConnected`, `connectBluesky`, `blueskyUser` (`store/auth`); `loadBlueskyFeed`, `loadSavedFeeds` (`store/bluesky`).

**Design (impeccable):** when `!isConnected.value`, the Network feed body shows a quiet empty state: the line "Connect Bluesky to see popular posts from your network" and a "Connect Bluesky" affordance (one-click if a handle is already known, else a handle input). On connect, run `loadSavedFeeds()` then `loadBlueskyFeed()`. This is the ONLY place the feed-only connect appears.

**Handler (exact):**

```js
async function handleFeedConnect(e) {
  if (e) e.preventDefault();
  setFeedErr(null);
  try {
    const h = feedHandle.trim();
    if (!h) { setFeedErr('Enter your Bluesky handle.'); return; }
    await connectBluesky(h);
    await loadSavedFeeds();
    await loadBlueskyFeed();
  } catch (err) { setFeedErr(err.message); }
}
```

- [ ] **Step 1:** Read `BlueskyFeed.jsx`; locate its not-connected/empty branch. With `impeccable` (`craft`), add the contextual connect there using the handler above and reused classes. (If the feed has no dedicated empty state today, add a `!isConnected.value` branch at the top of its render.)
- [ ] **Step 2:** `cd extension && npm run build`.
- [ ] **Step 3:** `[Human]` smoke: as an email-signed-in user (no Bluesky), the Network tab shows the connect affordance; connecting loads the feed; the account section shows no second Bluesky control.
- [ ] **Step 4:** `impeccable polish`.
- [ ] **Step 5:** Commit — `git add extension/src/components/BlueskyFeed.jsx && git commit -m "feat: contextual Bluesky feed connect in the Network empty state (impeccable)"`

---

### Task 4: Legacy app-password reconnect prompt

**Files:**
- Modify: `extension/src/components/BlueskyFeed.jsx` (or the Network empty state from Task 3)

**Interfaces (Consumes):** `legacyBlueskySession` (from B Task 5, `store/auth`), `connectBluesky`.

**Design (impeccable):** when `legacyBlueskySession.value && !isConnected.value`, the Network empty state leads with "Reconnect Bluesky to restore your feed" (a one-line explanation that sign-in changed), above the same connect affordance. After a successful `connectBluesky`, the legacy flag clears (handled in B) and the prompt disappears.

- [ ] **Step 1:** With `impeccable`, add the `legacyBlueskySession.value` branch to the Network empty state, reusing Task 3's connect handler. Import `legacyBlueskySession`.
- [ ] **Step 2:** `cd extension && npm run build`.
- [ ] **Step 3:** `[Human]` smoke: with an old `mc_bluesky_session` present in localStorage, the reconnect prompt shows; reconnecting clears it.
- [ ] **Step 4:** Commit — `git add extension/src/components/BlueskyFeed.jsx && git commit -m "feat: prompt legacy app-password users to reconnect"`

---

## Out of scope
- Any store/lib logic (subsystem B owns it).
- community-admin (subsystem A).
- The extension release (version bump + tag) is a separate manual step after all three subsystems land and smoke.

## Spec coverage
- Network rename -> Task 1. Two-door account + remove app-password box -> Task 2. Contextual feed connect -> Task 3. Legacy reconnect -> Task 4. Friendly-handle display + email fallback reuse #19's `caIdentityLabel`/email form. All trace to `2026-07-03-mc-unified-atproto-signin-design.md` subsystem C.

## Build order reminder
A (community-admin S5, deployed) -> B (MC core, merged) -> C (this). Task 2/3/4 human smokes need A live and B merged.
