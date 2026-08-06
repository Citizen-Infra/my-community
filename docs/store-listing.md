# Chrome Web Store listing — My Community

Draft copy and disclosures for the submission (#90). Every claim here is derived
from the code, and every field is cross-checked against **Dear Neighbors'** live
listing — a sibling CIBC extension already through review
([`mofcajnlfddkgiibgodmdhghfiakgdab`](https://chromewebstore.google.com/detail/dear-neighbors/mofcajnlfddkgiibgodmdhghfiakgdab)).

Inconsistency between two listings from the same publisher is the kind of thing
a reviewer notices, so the differences below are deliberate, not accidental.

---

## Data disclosures

Chrome makes you tick categories from a fixed taxonomy. "Collect" means
**transmitted off the device** — data that only ever sits in local storage does
not get declared, which is why the saved-tab collections are absent here.

| Category | Declare? | Why |
|---|---|---|
| Personally identifiable information | **Yes** | The email address used for magic-link sign-in. |
| Authentication information | **Yes** | The Bluesky OAuth tokens and the Community Admin session token. |
| Website content | **Yes** | The URL and title of a page **only when the user chooses to suggest it** to their community's wiki. |
| Location | No | The extension has no location feature. |
| Web history | No | Saved tabs never leave the device, and nothing reads browsing history. |
| User activity | No | Chrome scopes this to clicks, scrolling, keystrokes and network monitoring. Voting on a proposal is the core function, not activity telemetry. |
| Health, financial, personal communications | No | None handled. |

**Where this differs from Dear Neighbors, and why.** DN declares *Personally
identifiable information, Location, Website content*. My Community drops
**Location** (no such feature) and adds **Authentication information**, because
it holds Bluesky OAuth tokens rather than only a magic-link session. DN arguably
sits close to that line too; that is DN's call, not something to change here to
force a match.

### The three certifications

All standard, all true, all affirmable:

- Not sold to third parties, outside the approved use cases — **true**, nothing is sold.
- Not used or transferred for purposes unrelated to core functionality — **true**.
- Not used or transferred to determine creditworthiness or for lending — **true**.

### Remote code

**None.** No code is fetched and executed at runtime. Since #93 the typefaces
ship with the extension, and since #92 site icons come from Chrome's own cache,
so there are no third-party requests during normal use at all.

---

## Single purpose

> My Community replaces the new tab page with a dashboard for the communities a
> person belongs to, and manages their saved tabs.

Chrome wants one narrow purpose. The tab manager and the dashboard share the new
tab surface, which is the honest framing — claiming a single feature and shipping
two invites a rejection.

---

## Permission justifications

One line each, each grounded in a real call site.

| Permission | Justification |
|---|---|
| `tabs` | Saves the current tab to a collection and reopens saved ones. Needs the active tab's URL and title, and the ability to open and close tabs. |
| `storage` | Stores saved tab collections, settings and the community session locally. Also the only channel the service worker can read the new-tab page's state through. |
| `alarms` | Schedules the daily local backup of saved tabs. A service worker is evicted between events, so a timer cannot be used. |
| `downloads` | Writes the backup file to disk when the user chooses to export their saved tabs. |
| `bookmarks` | Read-only, and only when the user opens Import Bookmarks, to display the folder tree to choose from. Never modified. |
| `identity` | Runs the Bluesky sign-in via `launchWebAuthFlow` — the standard extension OAuth path. |
| `scripting` | Injects one short-lived local function that shows a confirmation toast on the page when a tab is saved or suggested. No remote code. |
| `activeTab` | Grants access to the current tab only when the user clicks the toolbar button or uses the keyboard shortcut. |
| `favicon` | Shows each saved site's icon from Chrome's own local favicon cache. This **replaced** a third-party request to Google (#92), so it removes a data flow rather than adding one. |
| Host permissions | Contacts the nine services the extension reads from, listed in the privacy policy, and no others. |

`bookmarks`, `downloads` and `scripting` draw the hardest questions. The good
answers are already true: bookmarks is read-only and user-initiated, downloads
only ever writes a file the user asked for, and scripting injects one local
function.

---

## Store description

Structured after DN's, which passed review.

> A dashboard for your communities, every time you open a new tab.
>
> My Community replaces your new tab with the things your communities are doing
> right now — and keeps your saved tabs in the same place.
>
> **What you get**
> - Community digest — links your community is sharing, with previews
> - Participation — events, sessions and open decisions you can take part in
> - Network — popular posts from the people you follow on Bluesky
> - A tab manager — save a tab with one keystroke, restore it whenever
>
> **How it works**
> - Choose the communities you follow; the dashboard shows only those
> - Sign in by email or with Bluesky — both work, neither is required to browse
> - Save the current tab with Alt+S, or suggest a page to your community's wiki with Alt+Shift+S
> - Vote on open decisions from the dashboard
>
> **Privacy-first**
> - Your saved tabs and settings never leave your computer
> - No analytics, no tracking, no ads, nothing sold
> - No third-party requests: the fonts ship with the extension and site icons come from your browser's own cache
> - Open source, AGPL-3.0
>
> Built by the Citizen Infrastructure Builders Club — open-source tools for
> community-level civic participation.

**Category:** Extensions → Communication (DN's category; same shape of product).

---

## Two things to decide before submitting

**1. Publisher identity — probably a profile setting, not a second account.**

DN's listing reads **"Offered by Artem Zhiganov"** with only an email in the
developer section. So the one CIBC extension already on the store is publicly
attributed to a person rather than the club — the
[cibc-brain#30](https://github.com/Citizen-Infra/cibc-brain/issues/30) shape, on
a surface every installer reads.

The obvious framing is "personal account vs. a CIBC account, costing another
fee and stranding DN unless transferred." **That framing is probably wrong.**

Compare a published organisation listing — Grammarly has **no "Offered by
<person>" line at all**. It has a publisher page carrying a name, website,
postal address and trader status. The difference from DN is not two kinds of
account; it is a **filled-in publisher profile versus a bare one**. The
[chromium-extensions list](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/RKkcnA6UWtE/m/zuopmx1kGAAJ)
describes "offered by" as the *verified publisher* field, populated from domains
verified on the Google account.

CIBC now owns `citizeninfra.org`. So the likely path is: **verify that domain on
the existing developer account and set the publisher display name** — no new
account, no second fee, and it fixes DN's attribution at the same time rather
than leaving it behind.

**Confidence: good, not confirmed.** This is inferred from two live listings plus
a Chromium list post; Chrome's own doc pages for it 404 at the URLs I tried, so
nobody has read the authoritative page. **Check the developer dashboard's account
settings before acting on it** — if a publisher display name and domain
verification are there, this is ten minutes and the dilemma disappears.

**2. The privacy policy URL.** DN uses a **GitHub blob URL** —
`https://github.com/Citizen-Infra/dear-neighbors/blob/master/PRIVACY.md` — and
review accepted it. So a repo-hosted policy is demonstrably sufficient.

My Community's is published at
**`https://citizeninfra.org/privacy/my-community`**, which is better for a
non-technical audience, but that was a quality choice and never a blocker. Use
the citizeninfra.org URL; the point is only that nothing was waiting on it.

---

## The upload artifact

`My-Community-v0.3.22-store.zip`, built from `master` and verified: `manifest.json`
at the archive root, the dev `key` stripped, version `0.3.22`, 9 permissions and
9 host permissions. Regenerate with `./scripts/package-zip.sh --store` after any
version bump — the ordinary release zip nests its manifest two levels down and
the store rejects it as missing.

The 128px icon the listing asks for already ships inside the package
(`icons/icon-128.png`); it is the same file, so nothing new needs drawing.

Fonts and icons are bundled rather than fetched, which is what makes the "no
third-party requests" claim in the description literally true — the zip listing
is the evidence for it.

---

## Screenshots

The only asset genuinely still missing. 1280×800 or 640×400, PNG or JPEG, up to
five. **Screenshots carry no captions on the store**, so each one has to explain
itself with no text alongside it.

### Shot list

DN ships two. Four is better here, because the single-purpose statement claims
*two* functions — a community dashboard and a tab manager — and a reviewer
checking that claim should be able to see both without reading it. Shots 1 and 3
are the pair that does that; 2 and 4 are supporting.

| # | View | What it has to show | Why this one |
|---|---|---|---|
| 1 | **Participation** | Events, sessions, and at least one open decision with its vote control | The differentiating view. Without it this reads as another tab manager. |
| 2 | **Digest** | Several link cards with OG thumbnails loaded | Visually the richest, and the fastest to understand at thumbnail size. |
| 3 | **Tab manager** | A populated collection, several saved tabs | Backs the second half of the single-purpose claim. |
| 4 | **Network** | Bluesky posts with the filter bar visible | Shows the third feed and that filtering is the user's. |

Every shot must be **populated**. An empty state is the usual way an extension
screenshot ends up looking broken, and three of these four views are empty until
a community is selected and sign-in has happened.

### Capturing at exactly 1280×800

A browser window sized to 1280×800 does not give a 1280×800 viewport — the
window chrome takes the difference, and the result is short. Use DevTools
instead, which captures the viewport at whatever size you set:

1. Open a new tab (the dashboard), then `F12`.
2. `Ctrl+Shift+M` for the device toolbar.
3. Set **Responsive**, dimensions **1280 × 800**, **DPR 1**, zoom **100%** — not "Fit".
4. Device toolbar `⋮` → **Capture screenshot**.

DPR is the one that quietly ruins a batch: at DPR 2 you get a 2560×1600 file,
which is not one of the accepted sizes.

### Privacy pass before uploading

These go on a public listing, and the dashboard is full of other people's
content by design. Check each shot for:

- **The signed-in email address**, visible in Settings. It must not appear in any shot.
- **A private community.** Use CIBC or another public one. v0.3.22 made exactly this distinction load-bearing in the product; a screenshot should not undo it.
- **Saved tabs**, which are your own URLs and titles. Curate the collection before shooting.
- **The Network feed**, which shows real posts from real accounts. The posts are already public on Bluesky, but *whose posts you see* discloses who you follow. Defensible either way — decide deliberately rather than by accident.

---

## Submission sequence

Everything above is done and checked in. What remains needs a Google account and
a card, so it stops at the dashboard.

1. **Chrome Web Store developer account** — one-off fee. Before adding the item, look for **domain verification** and a **publisher display name** in account settings. If both are there, verifying `citizeninfra.org` fixes the "Offered by Artem Zhiganov" line on DN's listing at the same time, and no second account is needed. This is the inference in the section above; the settings page confirms or kills it in ten minutes.
2. **Add new item**, upload `My-Community-v0.3.22-store.zip`. **Do not publish.**
3. **Package tab → View public key.** Copy what sits between the BEGIN/END markers and strip the newlines. This is the whole reason the upload comes before publication: it reveals the store-assigned ID while the item is still a draft.
4. **Paste that key into `extension/public/manifest.json` as `key`.** Sideload and store then share one ID.
5. **Add the new ID** to community-admin's `MC_EXTENSION_REDIRECT` and `EXTENSION_ORIGINS`. Both are allowlists already (community-admin#110), so old and new IDs work at once and publication stops being an event.
6. **Fill the listing** from this document, attach the screenshots, and submit.

One open question worth settling before step 6, because it is not recorded
anywhere. `CLAUDE.md` requires a manual Bluesky sign-in check for any release
touching `host_permissions`, `oauth-atproto.js`, or `config.js`, and #90 logged
that check as the sole gate on the v0.3.20 tag. v0.3.21 and v0.3.22 have shipped
since, and nothing says whether it ran. The procedure is in `CLAUDE.md` under
*Verifying a real Bluesky sign-in*; step 4 there — signing out first — is the
one that decides whether the test proves anything.
