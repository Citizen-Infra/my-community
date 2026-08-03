# Privacy Policy — My Community

**Last updated: 3 August 2026**

My Community is a browser extension published by the Citizen Infrastructure Builders Club. It replaces your new tab with a dashboard for the communities you choose, and it manages saved tabs.

This policy describes every piece of information the extension handles and every place it sends anything. It is short because the extension does little: almost everything stays on your own computer.

## What stays on your computer

None of this is transmitted anywhere. It lives in your browser's local storage and is removed when you uninstall the extension.

- **Saved tabs and collections** — the title and address of each tab you save, and how you have grouped them.
- **Your settings** — which communities you follow, your theme, which tabs are visible, and your feed preferences.
- **Your Bluesky sign-in** — if you connect Bluesky, the security key and access tokens created during sign-in are stored in your browser and used only to talk to your own Bluesky server.
- **Your community sign-in** — a session token from Community Admin, the service that manages membership.
- **Cached feed content** — recently fetched posts, links and events, kept briefly so the dashboard opens quickly.

Your browsing history is not collected, stored, or transmitted. The extension reads a tab's address only at the moment you ask it to save that tab, suggest it to your community, or import your bookmarks.

## What leaves your computer

**Bluesky**, only if you choose to connect it. Signing in and reading your feed happens directly between your browser and Bluesky's servers, or whichever server hosts your account. We do not see or store your Bluesky password, and your posts and timeline are not sent to us.

**Community Admin** (`admin.citizeninfra.org`), the membership service for your communities. It receives the email address or Bluesky identity you sign in with, and anything you deliberately submit: a link you suggest to your community's wiki, or a vote you cast on a proposal.

**Scenius Digest**, which supplies community links and events. When you are signed in, requests for events carry a short-lived identity token so that private communities can show you their events. Requests for public content carry no identity.

**Other community services** — the scheduling tool (`avails.citizeninfra.org`), the listening-room service, and a database that stores community sessions. These are read-only requests for content to display. They do not receive your identity.

That is the complete list. The extension makes no other outbound request during normal use — the typefaces and site icons it displays are served from the extension itself and from your browser's own cache.

## What we do not do

- No analytics, tracking, or telemetry of any kind. The extension contains no analytics code.
- No advertising, and no advertising networks.
- We do not sell, rent, or share your information with anyone.
- No code is downloaded and run from a remote server.
- We do not build a profile of you, and we do not track you across websites.

## Permissions, and why each one exists

| Permission | Why |
|---|---|
| Tabs | Save the current tab and reopen saved ones. |
| Storage | Keep your collections and settings on your computer. |
| Alarms | Schedule the daily local backup of your saved tabs. |
| Downloads | Write the backup file when you choose to export. |
| Bookmarks | Read-only, and only when you open Import Bookmarks, to show you the folders to choose from. Never modified. |
| Identity | Perform the Bluesky sign-in. |
| Scripting | Show a brief confirmation on the page when you save or suggest a tab. |
| Active tab | Access the current tab only when you click the toolbar button. |
| Favicon | Show each saved site's icon, read from your browser's own icon cache. No request is made to any website. |
| Site access | Contact the services listed above, and no others. |

## Your data, your control

Everything the extension stores is on your computer. Removing the extension removes all of it. You can export your saved tabs at any time from Settings, and disconnect Bluesky or sign out of your community account without losing your saved tabs.

To remove information you have submitted to a community — a suggested link, a vote — contact the organisers of that community.

## Children

My Community is not directed at children under 13 and does not knowingly collect information from them.

## Changes

This policy will be updated when the extension's behaviour changes. The date at the top always reflects the most recent revision, and the full history is public in the extension's source repository.

## Contact

Questions about this policy: **hello@citizen-infra.org**

Source code: <https://github.com/Citizen-Infra/my-community>
