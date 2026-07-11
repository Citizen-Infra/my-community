# My Community

A Chrome extension that turns your new tab into a community dashboard and a tab manager. Stay connected to your communities, and keep your tabs in tidy collections, without endless scrolling.

## What you get

**Community Digest** — Curated links shared by your communities, with thumbnails and descriptions. No algorithmic noise, just what your people are reading.

**Bluesky Network** — Popular posts from people you follow, sorted by engagement. See what resonated in the last 24 hours, week, or month. Connect your Bluesky account to enable this feed.

**Participation** — Upcoming sessions, deliberations, and events from your communities. Never miss an opportunity to join the conversation.

**Saved Tabs** — A built-in tab manager. Save the current tab with the toolbar button or Alt+S, organize tabs into collections, drag to reorder, search across everything, and import from Toby or your bookmarks. Everything stays local with automatic daily backups.

Toggle any feed on or off. Choose light, dark, or system theme. The extension works without Bluesky — digest and participation are always available.

## Install

1. Download the latest `.zip` from [Releases](https://github.com/Citizen-Infra/my-community/releases)
2. Extract the folder
3. Open Chrome and go to `chrome://extensions`
4. Enable "Developer mode" (toggle in top-right)
5. Click "Load unpacked" and select the extracted folder
6. Open a new tab — you're in!

## Getting started

Click the gear icon to:
- Sign in to your community account with Bluesky or email
- Select your communities
- Toggle which feeds to show

Open the Network tab and connect Bluesky to see popular posts from people you follow (optional).

## Changelog

### 0.3.5 — July 2026
- **The consent loop closes.** Objected decisions now show the objection itself (who raised it stays private), you can change your response any time while the window is open, and amended re-posts link back to the version they replace.
- **You can see there's something to decide.** The Community Input tab shows a badge with the number of open decisions you haven't responded to.

### 0.3.4 — July 2026
- **Decisions show where they came from.** A decision drafted from a sync meeting now names the meeting it came from, so you know which conversation you are being asked to consent to.

### 0.3.3 — July 2026
- **Community Input: decide together by consent.** A new signed-in tab shows the decisions your communities are weighing. Agree, pass, or raise a blocking objection with a reason. Silence counts as consent, and a decision ratifies when its window closes without an objection. Sign in with email or Bluesky to take part.

### 0.3.2 — July 2026
- **Bluesky now stays connected.** Fixed a bug where the Network feed kept asking you to reconnect Bluesky even though you had already signed in. Your sign-in now persists reliably across new tabs and days.

### 0.3.1 — July 2026
- **Cleaner, more consistent typography.** The editorial serif is now reserved for the "My Community" wordmark and the title of the collection you are viewing; sidebar and settings labels use the clean sans throughout. "Dashboard" reads as a first-class destination above your collections.
- **Fixed the "Move to" menu.** Moving a saved tab to another collection now opens a proper floating menu that shows the full list, scrolls if it is long, and no longer gets clipped as you scroll the collection.

### 0.3.0 — July 2026
- **Sign in with Bluesky or email.** Your community account now has two equal sign-in options: a Bluesky account or an email magic link. Pick whichever your community knows you by.
- **One Bluesky sign-in for everything.** A single Bluesky sign-in powers both your community account and the Network feed. App passwords are retired; you sign in through Bluesky's own consent screen instead. If you used the old app-password flow, you will be prompted to reconnect once.
- **The Bluesky tab is now "Network."** The same ATProto protocol runs different networks (Bluesky, Blacksky, and more), so the tab reflects the network rather than one app. Connect the feed right from the Network tab.
- **Note:** this update adds the `identity` permission and a couple of Bluesky host permissions (for the in-browser sign-in), so Chrome will ask you to re-approve the extension on update.

### 0.2.0 — June 2026
- **Saved Tabs:** a full tab manager now lives alongside the dashboard. The dashboard is pinned at the top of the new side panel; your tab collections sit below it. Save tabs with the toolbar button or the Alt+S shortcut, drag to reorder within and across collections, search everything, and import from Toby or Chrome bookmarks. Tabs are stored locally with a daily backup.
- Save targets and backups are configurable in Settings → Save Behavior / Backups; set the keyboard shortcut at `chrome://extensions/shortcuts`.
- **Note:** this update adds the `alarms`, `downloads`, and `bookmarks` permissions (for backups, daily backup files, and bookmark import), so Chrome will ask you to re-approve the extension on update.

### 0.1.4 — February 2026
- Live jam rooms from [Navidrome Jam](https://github.com/zhiganov/navidrome-jam) appear in the participation feed with animated equalizer bars
- Community selection moved to its own settings section — events-only communities (Newspeak House, Civic Tech Toronto, Metagov) no longer shown under "Telegram groups"
- Metagov added as a community (Luma events)

### 0.1.3 — February 2026
- Participation feed now aggregates events from all selected communities (Telegram event links, external APIs)
- Events color-coded by community — accent bars and badges match digest feed colors
- Source badges (Luma, Telegram) and location display on event cards

### 0.1.2 — February 2026
- Like and unlike Bluesky posts directly from the feed
- Digest links now stay visible for 7 days (previously disappeared after Telegram digest was posted)

### 0.1.1 — February 2026
- Choose from your saved Bluesky feeds
- See which community each link comes from (color-coded badges)
- Share links to Bluesky with one click
- Cleaner settings organized by feed

### 0.1.0 — February 2026
- Community dashboard replacing Chrome new tab
- Community Digest with thumbnails and descriptions
- Bluesky feed with time windows (24h/7d/30d) and engagement sorting
- Participation feed with sessions and events
- Light/dark/system theme

## Roadmap: ATProto as shared identity

My Community currently uses Bluesky app passwords for the Bluesky feed. As the Citizen Infrastructure ecosystem adopts ATProto OAuth as a shared identity layer, the dashboard becomes a unified hub:

- **One login for all tools.** Sign in with your Bluesky handle once — your identity works across avails (scheduling), navidrome-jam (music), community-admin, and any future Citizen Infra tool. No separate accounts.
- **Zero-friction scheduling.** When you click an [avails](https://github.com/Citizen-Infra/avails) poll banner, your identity is already known — go straight to marking availability instead of entering your name.
- **Create polls from the dashboard.** Embed avails poll creation directly in the participation feed. Your OAuth session writes to your PDS without leaving the new tab.
- **Richer participation feed.** Show personalized status on poll banners ("You haven't responded yet" vs "You responded — 3 slots") by matching your DID against poll responses.
- **Activity tracking.** Polls you created or responded to, jam sessions you joined, community events you RSVP'd to — all visible in one place, powered by ATProto records.

ATProto identity turns a collection of independent tools into a coherent ecosystem where your data and identity flow between apps on an open protocol.

---

Part of [Citizen Infrastructure](https://github.com/Citizen-Infra) — tools that teach collective action through use.

See also: [Dear Neighbors](https://github.com/Citizen-Infra/dear-neighbors) (neighborhood dashboard) · [Avails](https://github.com/Citizen-Infra/avails) (group scheduling) · [Scenius Digest](https://github.com/sensemaking-scenius/scenius-digest) (digest data source)
