# My Community — Product Analytics (PostHog) — Design

**Issue:** Citizen-Infra/my-community#20 · **Date:** 2026-07-09

## Goal

Know how MC is actually used — dashboard opens, which feed tabs get viewed, community selection, whether people connect Bluesky, which digest links and events get clicked — across both the current zip/"Load unpacked" beta and the eventual Chrome Web Store release. There is no built-in telemetry for either distribution, so a product-analytics tool is the only usage signal we get.

## Why PostHog, and why this exact config

PostHog is already the workspace analytics stack (Harmonica App/Website, book-power). Reusing it means one login, one bill, the existing PostHog MCP, and $0 (1M events/month free tier easily covers MC).

The catch is Manifest V3: stock `posthog-js` lazy-loads remote scripts (session recorder, surveys, web-vitals) at runtime, which MV3's CSP forbids and which gets extensions **rejected by CWS review** for "remotely-hosted code." The fix (PostHog's current MV3 guidance, https://posthog.com/docs/advanced/browser-extension) is to bundle the no-external build and disable remote loading. Crucially, **this same config is what makes analytics work in an unpacked/zip install** — Chrome enforces the CSP at runtime regardless of how the extension was installed. So one config serves beta and store.

## Decisions

- **PostHog home:** a new project in the existing shared "Harmonica" PostHog org (same pattern as book-power project `432375`), not a separate org. Reversible later via one env var.
- **Privacy:** anonymous by default (device-level, no PII). `identify()` by handle only *after* the user signs into the community account (they've already chosen to be known). A Settings toggle calls `posthog.opt_out_capturing()`. Disclosed in the README.
- **Events:** curated custom events, autocapture off (cleaner data for a small tool, less noise, more respectful of a privacy-conscious ATProto/civic audience).

## Architecture

MC is a **new-tab override**: the entire UI is `src/newtab.html` in one extension-page context. That means one PostHog instance, `localStorage` shared across every new-tab open, and automatic device continuity — no cross-context distinct-ID juggling. The `background.js` service worker (Alt+S save command, alarms, auth refresh) is a *separate* context with no DOM/localStorage; it is **out of scope for v1**.

A single wrapper module centralizes everything so instrumentation stays one-liners and opt-out is enforced in one place:

**`src/lib/analytics.js`**
- `initAnalytics()` — construct the no-external PostHog, `init()` with the MV3-safe config, register `app_version` (from the manifest) as a super-property, and apply the persisted opt-out state. No-ops cleanly when `VITE_POSTHOG_KEY` is unset (local dev, or before the project exists).
- `track(event, props?)` — thin `posthog.capture()`; no-op if not initialized.
- `identifyByHandle(handleOrDid)` — `posthog.identify()`; called from `caAuth` after community sign-in.
- `setAnalyticsOptOut(bool)` / `isAnalyticsOptedOut()` — persist to `localStorage` key `mc_analytics_optout` (default `false` = anonymous analytics on) and call `opt_out_capturing()` / `opt_in_capturing()`.

### Init config

```js
import { PostHog } from 'posthog-js/dist/module.no-external'
const posthog = new PostHog()
posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
  disable_external_dependency_loading: true, // MV3: no remote scripts
  persistence: 'localStorage',               // never cookies in an extension
  autocapture: false,
  capture_pageview: false,                   // fire dashboard_opened manually instead
  disable_session_recording: true,
})
```

### Manifest changes

- Add `https://us.i.posthog.com/*` to `host_permissions`.
- **Do not** add a `content_security_policy` key. MC currently uses the permissive MV3 default; introducing the PostHog docs' example `connect-src` would restrict outbound fetch and break Supabase / scenius-digest / Bluesky / Luma. The bundled no-external library already satisfies the default `script-src 'self'`.

## Event taxonomy (v1)

All page-context, so all trackable now:

| Event | Where | Properties |
|---|---|---|
| `dashboard_opened` | app mount | `app_version` (super-prop) |
| `tab_viewed` | `store/tabs.js` active-tab change | `{ tab }` |
| `community_selected` | `store/communities.js` | `{ count }` |
| `bluesky_connected` | `store/auth.js` connect success | — |
| `community_signed_in` + `identify()` | `store/caAuth.js` after sign-in | `{ method: 'email' \| 'bluesky' }` |
| `digest_link_clicked` | `DigestCard.jsx` | `{ has_og_image }` |
| `event_clicked` | `SessionsPanel.jsx` | `{ source }` |
| `settings_opened` | `SettingsModal.jsx` | — |
| `analytics_opt_out` / `analytics_opt_in` | Settings toggle | — |

`tab_saved` (the Alt+S / action-button save) originates in the service worker and is **deferred** with the rest of the SW instrumentation.

## Out of scope (v1)

Service-worker/background events (incl. `tab_saved`), session recording, surveys, feature flags, error tracking. Any of these can be added later; error tracking in particular is a cheap follow-up (`error_tracking: { captureExtensionExceptions: true }`).

## Verification

MC has no test framework, so verification is manual: production build, load unpacked, `posthog.debug(true)` in the new-tab devtools, exercise each event, and confirm they land in the PostHog project's Activity feed within a minute. Plus a CWS-readiness check: grep the built `dist/` for any `us-assets.i.posthog.com` remote-script reference (there should be none) so the store-review path is clean.

## Definition of done

PostHog project created + token in env → wrapper + instrumentation built → manifest + README + version bump → built, loaded unpacked, all v1 events verified live in PostHog → no remote-script references in `dist/` → released (tag) the same way as other MC versions.
