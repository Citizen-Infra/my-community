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

**1. Which developer account.** DN's listing reads **"Offered by Artem
Zhiganov"** with `artem.zhiganov@newspeak.house` as the developer email. So the
one CIBC extension already on the store is publicly attributed to a person, not
to the club.

That is the same shape as the personal-domain problem in
[cibc-brain#30](https://github.com/Citizen-Infra/cibc-brain/issues/30), on a
surface every installer reads. Publishing My Community under the same account is
the cheap path and repeats it; a CIBC group publisher account costs another
one-off fee and leaves DN behind unless it is transferred too. Worth deciding
once, for both.

**2. The privacy policy URL.** DN uses a **GitHub blob URL** —
`https://github.com/Citizen-Infra/dear-neighbors/blob/master/PRIVACY.md` — and
review accepted it. So a repo-hosted policy is demonstrably sufficient.

My Community's is published at
**`https://citizeninfra.org/privacy/my-community`**, which is better for a
non-technical audience, but that was a quality choice and never a blocker. Use
the citizeninfra.org URL; the point is only that nothing was waiting on it.

---

## Assets still needed

Screenshots (1280×800 or 640×400), a 128px icon, and optionally a small
promotional tile. DN ships two screenshots, which is enough.
