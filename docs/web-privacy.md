# My Community Web privacy

My Community Web is the browser-based companion to the My Community extension. The public dashboard works without an account. Signing in adds private communities, member actions, and cross-device dashboard preferences.

## What stays on this device

The web app uses browser storage for:

- the signed-out dashboard profile, including selected public communities and tile settings;
- selector-matched cached community previews for faster and offline reading;
- the Community Admin session and short-lived identity token;
- the Bluesky OAuth session, including DPoP-bound tokens stored in IndexedDB;
- theme choice, which is never synchronized; and
- temporary state that binds email and Bluesky sign-in callbacks to the browser that started them.

Private caches are keyed to the signed-in Community Admin or Bluesky identity. Signing out clears private community caches, ends both account sessions in the web app, and restores the separate signed-out dashboard profile. Deselecting a community makes prior cached responses inaccessible because cache selectors must exactly match the active account and community set.

The optional service worker caches the application shell, fonts, icons, and other same-origin static assets. It does not cache authenticated requests, authorization-bearing requests, Community Admin API responses, or third-party feed responses.

## What follows an account

When signed in, Community Admin stores one revision-checked dashboard preference document for the linked account. It can contain:

- selected community identifiers;
- visible feeds and eligible supporting tiles;
- feed order and preview depths; and
- Network source, time window, repost, and ranking choices.

It does **not** contain credentials, cached feed content, theme, browser history, extension tabs, extension collections, or tab-manager settings. A newer remote revision cannot be overwritten silently: My Community asks which layout to keep and surfaces write conflicts for recovery.

## Authentication providers

- **Email:** Community Admin sends a magic link. The link returns a short-lived, single-use authorization code to `my.citizeninfra.org`; the long-lived session is delivered only in a no-store code-exchange response.
- **Bluesky / ATProto:** the browser signs in directly with the account's ATProto authorization server. My Community then asks the user's PDS for a service-auth assertion that Community Admin verifies. My Community never receives a Bluesky password.

Community Admin links verified email and ATProto identities to one account where the member has chosen to link them.

## Outward actions

Votes, likes, availability publishing, sign-in, and external navigation require a network connection. Offline mode is read-only and uses only a matching local snapshot. The interface pauses outward actions rather than pretending they succeeded.

## Clearing and deleting data

- **Sign out** removes local Community Admin credentials, disconnects the web app's Bluesky OAuth session, clears private feed caches, and restores the signed-out local dashboard.
- Clearing site data for `my.citizeninfra.org` removes all browser-local preferences, sessions, and cached content for the web companion.
- Dashboard preferences and linked identities stored by Community Admin are account data. My Community Web does not offer a destructive account-deletion shortcut. Members manage linked identities through Community Admin and should contact the Community Admin operator when they want the account and its synchronized preference document deleted.
- Extension tab collections and backups are separate, device-local data; using or clearing the web companion does not alter them.
