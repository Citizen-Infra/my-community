# My Community — Product Analytics (PostHog) — Implementation Plan

> **For agentic workers:** MC has **no test framework** (per CLAUDE.md), so this plan is not TDD. Each task ends with an explicit **manual verification** (build → load unpacked → `posthog.debug(true)` → confirm in PostHog Activity). Steps use checkbox syntax for tracking.

**Goal:** Ship anonymous-by-default product analytics for MC via PostHog, MV3-safe for both zip and CWS.

**Architecture:** One `src/lib/analytics.js` wrapper (init + `track`/`identify`/opt-out) initialized in the app entry; curated custom events wired into the existing signal stores and card components; a Settings opt-out toggle.

**Tech stack:** Preact + Vite + `posthog-js` (no-external bundle). Design + rationale: `docs/plans/2026-07-09-mc-product-analytics-design.md`. Issue: Citizen-Infra/my-community#20.

## Global Constraints

- Import **`posthog-js/dist/module.no-external`** only. Never the default `posthog-js` (it loads remote scripts → MV3 CSP failure + CWS rejection).
- Init config MUST include `disable_external_dependency_loading: true`, `persistence: 'localStorage'`, `autocapture: false`, `disable_session_recording: true`.
- **Never add a `content_security_policy` key to the manifest** (a restrictive `connect-src` would break Supabase / scenius-digest / Bluesky / Luma). Only add the PostHog host to `host_permissions`.
- **Anonymous by default, opt-out toggle.** No PII in event properties. `identify()` only after community sign-in. Default `mc_analytics_optout = false`.
- **`app_version` super-property** read at runtime from `chrome.runtime.getManifest().version` (authoritative regardless of file drift).
- **Env-unset = clean no-op.** If `VITE_POSTHOG_KEY` is absent (dev, or before the project exists), the wrapper must not throw and must not attempt any network call.
- The Settings toggle is a **visible UI change** → route Task 5 through the `impeccable` skill (`shape` → `craft` → `polish`), MC's warm-editorial forest-green design system.

---

## Task 1: Dependency, env, and manifest plumbing

**Prerequisite (manual, user or operator):** In the shared "Harmonica" PostHog org, create a new project "My Community", copy its **Project API key** (the `phc_…` client token), and put it in `extension/.env` as `VITE_POSTHOG_KEY`. This is a client-side ingest key (safe to bundle), not the personal/admin API key.

**Files:**
- Modify: `extension/package.json` (deps)
- Modify: `extension/public/manifest.json` (host_permissions)
- Modify: `extension/.env.example` (document the new vars)

- [ ] **Step 1: Add the dependency**

In `extension/package.json` `dependencies`, add:
```json
"posthog-js": "^1.200.0"
```
(Pin to the latest 1.x at install time; the no-external subpath has been stable across 1.x.)

- [ ] **Step 2: Add the PostHog host to `host_permissions`**

In `extension/public/manifest.json`, append to `host_permissions`:
```json
"https://us.i.posthog.com/*"
```
Do NOT add a `content_security_policy` key.

- [ ] **Step 3: Document env vars**

In `extension/.env.example` (create if missing, mirroring the existing `VITE_SUPABASE_*` entries) add:
```
VITE_POSTHOG_KEY=
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

- [ ] **Step 4: Install + build**

Run: `cd extension && npm install && npm run build`
Expected: install succeeds, build produces `dist/` with no errors.

- [ ] **Step 5: Verify manifest**

Confirm `extension/dist/manifest.json` contains the `https://us.i.posthog.com/*` host permission and still has NO `content_security_policy` key.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore(analytics): add posthog-js dep, host permission, env vars"`

---

## Task 2: Analytics wrapper + init + `dashboard_opened`

**Files:**
- Create: `extension/src/lib/analytics.js`
- Modify: the app entry that mounts the root component (`extension/src/main.jsx`)

**Interfaces produced (used by later tasks):**
- `initAnalytics(): void`
- `track(event: string, props?: object): void`
- `identifyByHandle(handleOrDid: string, props?: object): void`
- `setAnalyticsOptOut(optOut: boolean): void`
- `isAnalyticsOptedOut(): boolean`

- [ ] **Step 1: Write the wrapper**

Create `extension/src/lib/analytics.js`:
```js
import { PostHog } from 'posthog-js/dist/module.no-external';

const OPT_OUT_KEY = 'mc_analytics_optout';
let ph = null;

export function isAnalyticsOptedOut() {
  return localStorage.getItem(OPT_OUT_KEY) === 'true';
}

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key || ph) return; // no-op without a token, or if already initialized
  ph = new PostHog();
  ph.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    disable_external_dependency_loading: true,
    persistence: 'localStorage',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
  });
  try {
    const version = chrome?.runtime?.getManifest?.().version;
    if (version) ph.register({ app_version: version });
  } catch { /* not in an extension context (dev preview) */ }
  if (isAnalyticsOptedOut()) ph.opt_out_capturing();
}

export function track(event, props) {
  if (ph) ph.capture(event, props);
}

export function identifyByHandle(handleOrDid, props) {
  if (ph && handleOrDid) ph.identify(handleOrDid, props);
}

export function setAnalyticsOptOut(optOut) {
  localStorage.setItem(OPT_OUT_KEY, optOut ? 'true' : 'false');
  if (!ph) return;
  optOut ? ph.opt_out_capturing() : ph.opt_in_capturing();
}
```

- [ ] **Step 2: Initialize at app entry + fire the first event**

In `extension/src/main.jsx`, before/after the `render(...)` call, add:
```js
import { initAnalytics, track } from './lib/analytics';
initAnalytics();
track('dashboard_opened');
```
(If `main.jsx` isn't the mount point, initialize in the root `App` component's first effect instead — one call, once.)

- [ ] **Step 3: Build + load unpacked**

Run: `cd extension && npm run build`, then reload at `chrome://extensions` (Load unpacked → `extension/dist/`). Open a new tab.

- [ ] **Step 4: Verify live**

In the new-tab devtools console: `window.__ph` is not required — instead confirm no CSP/remote-script errors, and check the PostHog project **Activity** feed shows a `dashboard_opened` event within ~1 minute. (Temporarily add `ph.debug(true)` after init while verifying if needed, then remove.)

- [ ] **Step 5: Verify the no-op path**

Rename `VITE_POSTHOG_KEY` to empty in `.env`, rebuild, confirm the app loads with zero console errors and no network calls to posthog. Restore the key afterward.

- [ ] **Step 6: Commit** — `feat(analytics): posthog wrapper + init + dashboard_opened`

---

## Task 3: Feed + navigation instrumentation

**Files:**
- Modify: `extension/src/store/tabs.js` (`tab_viewed`)
- Modify: `extension/src/store/communities.js` (`community_selected`)
- Modify: `extension/src/components/DigestCard.jsx` (`digest_link_clicked`)
- Modify: `extension/src/components/SessionsPanel.jsx` (`event_clicked`)

- [ ] **Step 1: `tab_viewed`** — in `store/tabs.js`, in the action that sets the active tab, call `track('tab_viewed', { tab })` with the new tab id. Import `track` from `../lib/analytics`.

- [ ] **Step 2: `community_selected`** — in `store/communities.js`, where the selected-community set changes, call `track('community_selected', { count })` with the number of selected communities (no slugs → no PII beyond community ids, which are public; `count` is enough for v1).

- [ ] **Step 3: `digest_link_clicked`** — in `DigestCard.jsx`, on the link click handler, call `track('digest_link_clicked', { has_og_image: Boolean(link.og_image) })`. Do not include the URL (keep it aggregate).

- [ ] **Step 4: `event_clicked`** — in `SessionsPanel.jsx`, on an event/opportunity click, call `track('event_clicked', { source })` using the event's existing `source` badge value (`telegram` / `luma` / `manual` / `supabase`).

- [ ] **Step 5: Build, load unpacked, verify** — exercise each: switch tabs, change communities, click a digest link, click an event. Confirm all four appear in PostHog Activity with the expected properties.

- [ ] **Step 6: Commit** — `feat(analytics): feed + nav events`

---

## Task 4: Identity instrumentation

**Files:**
- Modify: `extension/src/store/auth.js` (`bluesky_connected`)
- Modify: `extension/src/store/caAuth.js` (`community_signed_in` + `identify`)

- [ ] **Step 1: `bluesky_connected`** — in `store/auth.js`, in the `connectBluesky` success path (after a session is established), call `track('bluesky_connected')`.

- [ ] **Step 2: `community_signed_in` + identify** — in `store/caAuth.js`, after a successful community sign-in on BOTH paths (email magic-link verify and Bluesky `getServiceAuth` → `/auth/atproto/assert`), call:
```js
identifyByHandle(handle || subject, {}); // handle when known, else the subject (DID/email)
track('community_signed_in', { method }); // 'email' | 'bluesky'
```
Use the already-resolved `@handle` when available so PostHog shows a readable person, not a raw DID; never include the email address as a property.

- [ ] **Step 3: Build, load unpacked, verify** — connect Bluesky (expect `bluesky_connected`); sign into the community account each way (expect `community_signed_in` + a newly *identified* person in PostHog). Confirm the person is keyed by handle, not a raw DID, when a handle exists.

- [ ] **Step 4: Commit** — `feat(analytics): identity events + identify on sign-in`

---

## Task 5: Settings opt-out toggle + disclosure + version bump (VISIBLE — use impeccable)

> **Route this task through the `impeccable` skill** (`shape` → `craft` → `polish`). The toggle is a visible change in MC's warm-editorial forest-green system; match the existing SettingsModal controls.

**Files:**
- Modify: `extension/src/components/SettingsModal.jsx` (toggle + `settings_opened`)
- Modify: `extension/README.md` (privacy disclosure + changelog)
- Modify: `extension/package.json` + `extension/public/manifest.json` (version)

- [ ] **Step 1: `settings_opened`** — fire `track('settings_opened')` when the modal opens.

- [ ] **Step 2: Opt-out toggle** — add an "Anonymous usage analytics" toggle (a short Description-Below-Title control matching MC's design) bound to `isAnalyticsOptedOut()` (inverted). On change: `setAnalyticsOptOut(optedOut)` and `track(optedOut ? 'analytics_opt_out' : 'analytics_opt_in')` — the opt-out event fires *before* capturing stops, so PostHog records the choice. Copy: state plainly that analytics are anonymous, no personal content, and can be turned off. No em dashes.

- [ ] **Step 3: README disclosure + changelog** — add a short "Privacy / analytics" note to `extension/README.md` (anonymous, no PII, opt-out in Settings, PostHog) and a `0.4.0` changelog line.

- [ ] **Step 4: Version bump** — bump `extension/package.json` and `extension/public/manifest.json` to `0.4.0` (feature release). Note: these currently drift (pkg `0.3.2`, manifest `0.3.1`) — set BOTH to `0.4.0` to reconcile. First confirm whether the build injects the manifest version or copies `public/manifest.json` verbatim; bump the authoritative source either way.

- [ ] **Step 5: Build, load unpacked, verify** — open Settings (expect `settings_opened`). Toggle analytics OFF → confirm subsequent actions produce NO new PostHog events and `mc_analytics_optout=true` in localStorage. Toggle ON → events resume.

- [ ] **Step 6: Commit** — `feat(analytics): settings opt-out toggle + disclosure + v0.4.0`

---

## Task 6: CWS-readiness + final verification pass

- [ ] **Step 1: Remote-script scan** — grep the built output for any remote PostHog asset host: `grep -r "us-assets.i.posthog.com" extension/dist/ || echo "clean"`. Expected: `clean` (the no-external bundle pulls nothing remotely). This is the check that keeps CWS review clean.

- [ ] **Step 2: CSP integrity** — confirm `extension/dist/manifest.json` still has NO `content_security_policy` key and that all existing feeds (Network, Digest, Participation, Jam) still load after the changes.

- [ ] **Step 3: Full event sweep** — with analytics ON, exercise every v1 event once and confirm all appear in the PostHog project Activity feed with correct properties and a consistent distinct_id across a session; confirm `app_version` is attached to events.

- [ ] **Step 4: Opt-out integrity** — with analytics OFF, repeat the sweep and confirm zero events reach PostHog.

- [ ] **Step 5: Release** — follow MC's release process (tag `v0.4.0`, push tag; the `package.yml` workflow builds + attaches the zip). Post-release, confirm production traffic appears in PostHog.

---

## Self-review notes

- Every v1 event in the design taxonomy maps to a task (Tasks 2–5). `tab_saved` is intentionally deferred (service-worker origin) and called out in the design's Out-of-scope.
- No placeholders; all instrumentation points name a concrete file and the exact `track()` call.
- Interface names (`track`, `identifyByHandle`, `setAnalyticsOptOut`, `isAnalyticsOptedOut`) are defined in Task 2 and used verbatim in Tasks 3–5.
- No PII: events carry aggregate props only (`tab`, `count`, `has_og_image`, `source`, `method`); identify uses handle/DID, never email.
