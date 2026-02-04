# My Community Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fork dear-neighbors into "My Community" — a Chrome extension new tab page with three toggleable feeds (Bluesky Network, Community Digest, Participation) scoped by community selection.

**Architecture:** Preact + @preact/signals with Vite, Chrome MV3 extension. Consumes scenius-digest API for digests, ATproto API for Bluesky, Supabase for sessions, Luma API for events. No backend — all external APIs.

**Tech Stack:** Preact, @preact/signals, Vite, @supabase/supabase-js, @atproto/oauth-client-browser, ATproto API (XRPC)

**Design doc:** `docs/plans/2026-02-04-my-community-design.md`

---

### Task 1: Fork and Strip

Create the `my-community` directory from dear-neighbors, remove everything that doesn't apply.

**Step 1: Copy extension directory**

```bash
cp -r C:/Users/temaz/claude-project/dear-neighbors/extension C:/Users/temaz/claude-project/my-community/extension
```

**Step 2: Copy docs**

```bash
mkdir -p C:/Users/temaz/claude-project/my-community/docs/plans
cp C:/Users/temaz/claude-project/dear-neighbors/docs/plans/2026-02-04-my-community-design.md C:/Users/temaz/claude-project/my-community/docs/plans/
```

**Step 3: Delete removed files**

Delete these from `my-community/extension/src/`:
- `popup.html`
- `popup-index.jsx`
- `components/PopupForm.jsx`
- `components/SubmitLinkForm.jsx`
- `components/LinksFeed.jsx`
- `components/OnboardingModal.jsx`
- `components/EnvBadges.jsx`
- `store/links.js`
- `store/neighborhoods.js`
- `store/topics.js`
- `store/environment.js`
- `store/language.js`
- `lib/i18n.js`
- `lib/detect-language.js`
- `styles/popup.css`
- `styles/submit-form.css`
- `styles/links.css`
- `styles/onboarding-modal.css`
- `styles/env-badges.css`
- `styles/language.css`

**Step 4: Update `package.json`**

Change name to `my-community`, version to `0.1.0`. Keep all dependencies for now.

```json
{
  "name": "my-community",
  "version": "0.1.0",
  "private": true,
  "license": "AGPL-3.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "preact": "^10.25.4",
    "@preact/signals": "^1.3.1",
    "@supabase/supabase-js": "^2.49.1"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.9.3",
    "vite": "^6.0.7"
  }
}
```

**Step 5: Update `vite.config.js`**

Remove popup entry point:

```js
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  base: '',
  build: {
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, 'src/newtab.html'),
      },
    },
    outDir: 'dist',
  },
});
```

**Step 6: Update `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "My Community",
  "version": "0.1.0",
  "description": "A community dashboard with curated digests, Bluesky network feed, and participation opportunities.",
  "permissions": ["tabs", "storage"],
  "host_permissions": [
    "https://eeidclmhfkndimghdyuq.supabase.co/*",
    "https://scenius-digest.vercel.app/*",
    "https://api.lu.ma/*",
    "https://*.bsky.network/*",
    "https://bsky.social/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "chrome_url_overrides": {
    "newtab": "src/newtab.html"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Note: No `action` block — no toolbar popup.

**Step 7: Init git repo**

```bash
cd C:/Users/temaz/claude-project/my-community
git init
```

Create `.gitignore`:
```
node_modules/
dist/
.env.local
```

**Step 8: Install deps and verify build**

```bash
cd C:/Users/temaz/claude-project/my-community/extension
npm install
npm run build
```

Build will fail because App.jsx imports deleted files. That's expected — we fix it in Task 2.

**Step 9: Commit**

```bash
git add -A
git commit -m "Fork from dear-neighbors, strip unused files"
```

---

### Task 2: Skeleton App with Theme

Replace App.jsx and TopBar.jsx with minimal working versions. Get a blank new tab page that builds and loads.

**Files:**
- Modify: `extension/src/app.jsx`
- Modify: `extension/src/components/TopBar.jsx`
- Modify: `extension/src/store/theme.js` (rename `dn_theme` → `mc_theme`)
- Modify: `extension/src/styles/variables.css` (keep as-is, just verify)
- Modify: `extension/src/styles/global.css`
- Modify: `extension/src/styles/layout.css`
- Modify: `extension/src/styles/topbar.css`
- Modify: `extension/src/styles/settings-modal.css`
- Delete: `extension/src/styles/auth-modal.css` (will recreate later if needed)
- Modify: `extension/public/background.js` (gut it — placeholder for ATproto later)

**Step 1: Rewrite `store/theme.js`**

Change storage key from `dn_theme` to `mc_theme`:

```js
import { signal } from '@preact/signals';

export const theme = signal(localStorage.getItem('mc_theme') || 'system');

const mql = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const val = theme.value;
  if (val === 'light' || val === 'dark') {
    document.documentElement.dataset.theme = val;
  } else {
    document.documentElement.dataset.theme = mql.matches ? 'dark' : 'light';
  }
}

export function setTheme(val) {
  theme.value = val;
  localStorage.setItem('mc_theme', val);
  applyTheme();
}

export function initTheme() {
  applyTheme();
  mql.addEventListener('change', () => {
    if (theme.value === 'system') applyTheme();
  });
}
```

**Step 2: Rewrite `app.jsx`**

Minimal shell with TopBar and placeholder content:

```jsx
import { useEffect, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { TopBar } from './components/TopBar';
import './styles/layout.css';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTheme();
    setReady(true);
  }, []);

  if (!ready) {
    return <div class="loading-screen"><p>Loading...</p></div>;
  }

  return (
    <div class="app">
      <TopBar />
      <main class="dashboard">
        <p style="padding: 2rem; opacity: 0.5;">My Community — coming soon</p>
      </main>
    </div>
  );
}
```

**Step 3: Rewrite `TopBar.jsx`**

Strip neighborhood/topic/env references:

```jsx
import { useState } from 'preact/hooks';
import { SettingsModal } from './SettingsModal';
import '../styles/topbar.css';

export function TopBar() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <header class="topbar">
      <div class="topbar-inner">
        <div class="topbar-brand">
          <h1 class="topbar-title">My Community</h1>
        </div>

        <div class="topbar-actions">
          <button
            class="topbar-gear"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </header>
  );
}
```

**Step 4: Rewrite `SettingsModal.jsx`**

Minimal — just theme picker for now:

```jsx
import { theme, setTheme } from '../store/theme';
import '../styles/settings-modal.css';

export function SettingsModal({ onClose }) {
  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div class="settings-header">
          <h3 class="settings-title">Settings</h3>
          <button class="settings-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <section class="settings-section">
          <h4 class="settings-section-title">Theme</h4>
          <div class="theme-picker">
            {['light', 'dark', 'system'].map((val) => (
              <button
                key={val}
                class={`topic-grid-chip ${theme.value === val ? 'active' : ''}`}
                onClick={() => setTheme(val)}
              >
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </button>
            ))}
          </div>
        </section>

        <footer class="settings-about">
          Built by <a href="https://github.com/Citizen-Infra" target="_blank" rel="noopener">Citizen Infra</a>
        </footer>
      </div>
    </div>
  );
}
```

**Step 5: Gut `background.js`**

```js
// ATproto OAuth callback handler — placeholder
// Will intercept OAuth redirects and forward tokens to the extension
const EXTENSION_PAGE = 'src/newtab.html';
```

**Step 6: Build and verify**

```bash
cd C:/Users/temaz/claude-project/my-community/extension
npm run build
```

Expected: Build succeeds. Load `dist/` in Chrome as unpacked extension. New tab shows "My Community" title with gear icon and placeholder text.

**Step 7: Commit**

```bash
git add -A
git commit -m "Skeleton app with theme support"
```

---

### Task 3: Communities Store + Settings UI

Add community selection that fetches from scenius-digest API and persists to localStorage.

**Files:**
- Create: `extension/src/store/communities.js`
- Modify: `extension/src/components/SettingsModal.jsx`
- Modify: `extension/src/app.jsx`

**Step 1: Create `store/communities.js`**

```js
import { signal, computed } from '@preact/signals';

const GROUPS_API = 'https://scenius-digest.vercel.app/api/groups';

export const allCommunities = signal([]);
export const communitiesLoading = signal(false);

// Persisted: array of community keys (e.g. ["scenius", "cibc"])
const stored = JSON.parse(localStorage.getItem('mc_communities') || '[]');
export const selectedCommunityIds = signal(stored);

export const communitiesConfigured = computed(() => selectedCommunityIds.value.length > 0);

export const selectedCommunities = computed(() =>
  allCommunities.value.filter((c) => selectedCommunityIds.value.includes(c.id))
);

export async function loadCommunities() {
  communitiesLoading.value = true;
  try {
    const res = await fetch(GROUPS_API);
    const data = await res.json();
    // Transform { scenius: { name: ... }, cibc: { name: ... } } → array
    const groups = Object.entries(data.groups || data).map(([key, val]) => ({
      id: key,
      name: val.name,
      topics: val.topics ? (Array.isArray(val.topics) ? val.topics : Object.keys(val.topics)) : [],
      luma_url: val.luma_url || null,
    }));
    allCommunities.value = groups;
  } catch (err) {
    console.error('Failed to load communities:', err);
  }
  communitiesLoading.value = false;
}

export function toggleCommunity(id) {
  const current = selectedCommunityIds.value;
  const next = current.includes(id)
    ? current.filter((c) => c !== id)
    : [...current, id];
  selectedCommunityIds.value = next;
  localStorage.setItem('mc_communities', JSON.stringify(next));
}
```

**Step 2: Update `SettingsModal.jsx`**

Add communities section above theme:

```jsx
import { allCommunities, selectedCommunityIds, toggleCommunity } from '../store/communities';
import { theme, setTheme } from '../store/theme';
import '../styles/settings-modal.css';

export function SettingsModal({ onClose }) {
  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div class="settings-header">
          <h3 class="settings-title">Settings</h3>
          <button class="settings-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <section class="settings-section">
          <h4 class="settings-section-title">Communities</h4>
          <div class="topic-grid">
            {allCommunities.value.map((c) => (
              <button
                key={c.id}
                class={`topic-grid-chip ${selectedCommunityIds.value.includes(c.id) ? 'active' : ''}`}
                onClick={() => toggleCommunity(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {allCommunities.value.length === 0 && (
            <p class="settings-hint">Loading communities...</p>
          )}
        </section>

        <section class="settings-section">
          <h4 class="settings-section-title">Theme</h4>
          <div class="theme-picker">
            {['light', 'dark', 'system'].map((val) => (
              <button
                key={val}
                class={`topic-grid-chip ${theme.value === val ? 'active' : ''}`}
                onClick={() => setTheme(val)}
              >
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </button>
            ))}
          </div>
        </section>

        <footer class="settings-about">
          Built by <a href="https://github.com/Citizen-Infra" target="_blank" rel="noopener">Citizen Infra</a>
        </footer>
      </div>
    </div>
  );
}
```

**Step 3: Update `app.jsx`**

Add community loading to init:

```jsx
import { useEffect, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { loadCommunities, communitiesConfigured } from './store/communities';
import { TopBar } from './components/TopBar';
import './styles/layout.css';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTheme();
    (async () => {
      await loadCommunities();
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return <div class="loading-screen"><p>Loading...</p></div>;
  }

  return (
    <div class="app">
      <TopBar />
      <main class="dashboard">
        {!communitiesConfigured.value ? (
          <div class="welcome-prompt">
            <h2>Welcome to My Community</h2>
            <p>Open settings to pick your communities.</p>
          </div>
        ) : (
          <p style="padding: 2rem; opacity: 0.5;">Feeds coming next...</p>
        )}
      </main>
    </div>
  );
}
```

**Step 4: Build and verify**

```bash
cd C:/Users/temaz/claude-project/my-community/extension
npm run build
```

Load in Chrome. Settings gear → should show community chips fetched from scenius-digest API. Selecting communities persists across tab opens.

**Step 5: Commit**

```bash
git add -A
git commit -m "Add community selection store and settings UI"
```

---

### Task 4: Tab Bar + Digest Feed

Add the tab bar component and the Community Digest tab (first real feed).

**Files:**
- Create: `extension/src/store/tabs.js`
- Create: `extension/src/store/digest.js`
- Create: `extension/src/components/TabBar.jsx`
- Create: `extension/src/components/DigestFeed.jsx`
- Create: `extension/src/components/DigestCard.jsx`
- Create: `extension/src/styles/tabs.css`
- Create: `extension/src/styles/digest.css`
- Modify: `extension/src/app.jsx`

**Step 1: Create `store/tabs.js`**

```js
import { signal, computed } from '@preact/signals';

// Tab visibility — persisted
const stored = JSON.parse(localStorage.getItem('mc_visible_tabs') || '{}');
export const visibleTabs = signal({
  network: stored.network ?? true,
  digest: stored.digest ?? true,
  participation: stored.participation ?? true,
});

export const activeTab = signal(localStorage.getItem('mc_active_tab') || 'digest');

export function setActiveTab(tab) {
  activeTab.value = tab;
  localStorage.setItem('mc_active_tab', tab);
}

export function setTabVisible(tab, visible) {
  const next = { ...visibleTabs.value, [tab]: visible };
  visibleTabs.value = next;
  localStorage.setItem('mc_visible_tabs', JSON.stringify(next));
  // If hiding the active tab, switch to first visible
  if (!visible && activeTab.value === tab) {
    const first = Object.entries(next).find(([, v]) => v);
    if (first) setActiveTab(first[0]);
  }
}

export const availableTabs = computed(() =>
  Object.entries(visibleTabs.value)
    .filter(([, visible]) => visible)
    .map(([key]) => key)
);
```

**Step 2: Create `store/digest.js`**

```js
import { signal } from '@preact/signals';

const LINKS_API = 'https://scenius-digest.vercel.app/api/links';
const CACHE_KEY = 'mc_digest_cache';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export const digestLinks = signal([]);
export const digestLoading = signal(false);

const TOPIC_EMOJI = {
  links: '\uD83D\uDCDA',
  memes: '\uD83C\uDFAD',
  news: '\uD83D\uDCF0',
  resources: '\uD83D\uDCDA',
};

export function topicEmoji(topic) {
  return TOPIC_EMOJI[topic] || '\uD83D\uDD17';
}

export async function loadDigest(communityIds) {
  if (communityIds.length === 0) {
    digestLinks.value = [];
    return;
  }

  // Check cache
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const cacheKey = communityIds.sort().join(',');
      if (cached.key === cacheKey) {
        digestLinks.value = cached.links;
        return;
      }
    }
  } catch {}

  digestLoading.value = true;

  try {
    const allLinks = [];
    await Promise.all(
      communityIds.map(async (id) => {
        const res = await fetch(`${LINKS_API}?group=${id}&days=14`);
        const data = await res.json();
        const links = (data.links || []).map((l) => ({ ...l, community_id: id }));
        allLinks.push(...links);
      })
    );

    // Sort by shared_at descending
    allLinks.sort((a, b) => new Date(b.shared_at) - new Date(a.shared_at));
    digestLinks.value = allLinks;

    // Cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      key: communityIds.sort().join(','),
      links: allLinks,
      timestamp: Date.now(),
    }));
  } catch (err) {
    console.error('Failed to load digest:', err);
  }

  digestLoading.value = false;
}
```

**Step 3: Create `components/TabBar.jsx`**

```jsx
import { activeTab, setActiveTab, availableTabs } from '../store/tabs';
import '../styles/tabs.css';

const TAB_LABELS = {
  network: 'Bluesky',
  digest: 'Digest',
  participation: 'Participation',
};

export function TabBar() {
  const tabs = availableTabs.value;
  if (tabs.length <= 1) return null;

  return (
    <nav class="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab}
          class={`tab-item ${activeTab.value === tab ? 'active' : ''}`}
          onClick={() => setActiveTab(tab)}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </nav>
  );
}
```

**Step 4: Create `components/DigestCard.jsx`**

```jsx
import { topicEmoji } from '../store/digest';

export function DigestCard({ link }) {
  const domain = (() => {
    try { return new URL(link.url).hostname.replace('www.', ''); }
    catch { return ''; }
  })();

  return (
    <a class="digest-card" href={link.url} target="_blank" rel="noopener noreferrer">
      <div class="digest-card-header">
        <span class="digest-card-topic">{topicEmoji(link.topic)} {link.topic}</span>
        {link.shared_by && <span class="digest-card-sharer">via {link.shared_by}</span>}
      </div>
      <h4 class="digest-card-title">{link.title || link.url}</h4>
      {link.description && (
        <p class="digest-card-description">{link.description}</p>
      )}
      <div class="digest-card-footer">
        <span class="digest-card-domain">{domain}</span>
        <span class="digest-card-time">
          {new Date(link.shared_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </a>
  );
}
```

**Step 5: Create `components/DigestFeed.jsx`**

```jsx
import { digestLinks, digestLoading } from '../store/digest';
import { DigestCard } from './DigestCard';

export function DigestFeed() {
  if (digestLoading.value) {
    return <div class="feed-empty">Loading digest...</div>;
  }

  if (digestLinks.value.length === 0) {
    return (
      <div class="feed-empty">
        No recent links from your communities.
      </div>
    );
  }

  return (
    <div class="digest-feed">
      {digestLinks.value.map((link) => (
        <DigestCard key={link.id} link={link} />
      ))}
    </div>
  );
}
```

**Step 6: Create basic CSS**

Create `styles/tabs.css` and `styles/digest.css` with minimal styling that uses existing CSS variables from `variables.css`. Key classes: `.tab-bar`, `.tab-item`, `.tab-item.active`, `.digest-feed`, `.digest-card`, `.feed-empty`.

**Step 7: Wire into `app.jsx`**

```jsx
import { useEffect, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { loadCommunities, communitiesConfigured, selectedCommunityIds } from './store/communities';
import { loadDigest } from './store/digest';
import { activeTab } from './store/tabs';
import { TopBar } from './components/TopBar';
import { TabBar } from './components/TabBar';
import { DigestFeed } from './components/DigestFeed';
import './styles/layout.css';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTheme();
    (async () => {
      await loadCommunities();
      setReady(true);
    })();
  }, []);

  // Reload digest when communities change
  useEffect(() => {
    if (!ready) return;
    const ids = selectedCommunityIds.value;
    if (ids.length > 0) {
      loadDigest(ids);
    }
  }, [ready, selectedCommunityIds.value]);

  if (!ready) {
    return <div class="loading-screen"><p>Loading...</p></div>;
  }

  return (
    <div class="app">
      <TopBar />
      {communitiesConfigured.value ? (
        <>
          <TabBar />
          <main class="dashboard">
            {activeTab.value === 'digest' && <DigestFeed />}
            {activeTab.value === 'participation' && (
              <div class="feed-empty">Participation — coming soon</div>
            )}
            {activeTab.value === 'network' && (
              <div class="feed-empty">Bluesky — coming soon</div>
            )}
          </main>
        </>
      ) : (
        <main class="dashboard">
          <div class="welcome-prompt">
            <h2>Welcome to My Community</h2>
            <p>Open settings to pick your communities.</p>
          </div>
        </main>
      )}
    </div>
  );
}
```

**Step 8: Build and verify**

```bash
npm run build
```

Load in Chrome. Select communities in settings. Digest tab should show links fetched from scenius-digest API.

**Step 9: Commit**

```bash
git add -A
git commit -m "Add tab bar and digest feed"
```

---

### Task 5: Participation Feed (Sessions + Luma)

Modify sessions store to filter by community. Add Luma events.

**Files:**
- Modify: `extension/src/store/sessions.js`
- Create: `extension/src/lib/luma.js`
- Modify: `extension/src/components/SessionsPanel.jsx`
- Modify: `extension/src/app.jsx`

**Step 1: Create `lib/luma.js`**

Research the Luma API at runtime. Luma's public calendar pages expose event data. For MVP, fetch the Luma calendar page and parse events from the API endpoint `https://api.lu.ma/calendar/get-items?calendar_api_id=<id>`.

```js
const CACHE_KEY = 'mc_luma_cache';
const CACHE_TTL = 60 * 60 * 1000;

export async function fetchLumaEvents(lumaUrl) {
  if (!lumaUrl) return [];

  try {
    // Extract calendar slug from URL (e.g. https://lu.ma/scenius → scenius)
    const slug = lumaUrl.replace(/\/$/, '').split('/').pop();
    const res = await fetch(`https://api.lu.ma/calendar/get-items?calendar_api_id=${slug}&period=future`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.entries || []).map((entry) => ({
      id: `luma-${entry.event?.api_id || entry.api_id}`,
      title: entry.event?.name || 'Untitled',
      description: entry.event?.description_short || '',
      url: `https://lu.ma/${entry.event?.url || slug}`,
      starts_at: entry.event?.start_at || null,
      ends_at: entry.event?.end_at || null,
      source: 'luma',
      status: getEventStatus(entry.event?.start_at, entry.event?.end_at),
    }));
  } catch (err) {
    console.error('Failed to fetch Luma events:', err);
    return [];
  }
}

function getEventStatus(startAt, endAt) {
  if (!startAt) return 'upcoming';
  const now = new Date();
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'completed';
}
```

Note: The Luma API structure may need adjustment at implementation time. The slug-based approach is the most common pattern. If the API requires a different identifier, the implementation should adapt.

**Step 2: Modify `store/sessions.js`**

Replace neighborhood-based filtering with community-based + Luma:

```js
import { signal, computed } from '@preact/signals';
import { supabase } from '../lib/supabase';
import { fetchLumaEvents } from '../lib/luma';

export const sessions = signal([]);
export const sessionsLoading = signal(false);

export const activeSessions = computed(() =>
  sessions.value.filter((s) => s.status === 'active')
);
export const upcomingSessions = computed(() =>
  sessions.value.filter((s) => s.status === 'upcoming')
);
export const completedSessions = computed(() =>
  sessions.value.filter((s) => s.status === 'completed')
);

export async function loadSessions(communities) {
  sessionsLoading.value = true;

  try {
    const results = [];

    // Fetch Supabase sessions (all for now — community scoping TBD)
    const { data } = await supabase
      .from('sessions_with_topics')
      .select('*')
      .order('starts_at', { ascending: true });
    if (data) {
      results.push(...data.map((s) => ({ ...s, source: 'session' })));
    }

    // Fetch Luma events for communities that have luma_url
    const lumaPromises = communities
      .filter((c) => c.luma_url)
      .map((c) => fetchLumaEvents(c.luma_url));
    const lumaResults = await Promise.all(lumaPromises);
    lumaResults.forEach((events) => results.push(...events));

    // Sort by starts_at
    results.sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0));

    sessions.value = results;
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }

  sessionsLoading.value = false;
}
```

**Step 3: Update `SessionsPanel.jsx`**

Add source badge (Luma vs Harmonica):

In `SessionCard`, add a source indicator. If `session.source === 'luma'`, show "Luma" badge. Otherwise keep existing badge logic.

**Step 4: Wire into `app.jsx`**

Load sessions when communities change:

```js
import { loadSessions } from './store/sessions';
import { selectedCommunities } from './store/communities';
// ... in the useEffect that watches selectedCommunityIds:
if (ids.length > 0) {
  loadDigest(ids);
  loadSessions(selectedCommunities.value);
}
```

Add to render: `{activeTab.value === 'participation' && <SessionsPanel />}`

**Step 5: Build, verify, commit**

```bash
npm run build
git add -A
git commit -m "Add participation feed with sessions and Luma events"
```

---

### Task 6: ATproto OAuth

Add Bluesky authentication. This is the most complex task.

**Files:**
- Create: `extension/src/lib/atproto.js`
- Rewrite: `extension/src/store/auth.js`
- Modify: `extension/public/background.js`
- Modify: `extension/src/components/SettingsModal.jsx`
- Modify: `extension/package.json` (add `@atproto/oauth-client-browser` or implement manually)

**Key decisions at implementation time:**
- ATproto OAuth for Chrome extensions is not straightforward. The `@atproto/oauth-client-browser` package expects a standard web app redirect flow. Chrome extensions can't receive redirects directly.
- The service worker must intercept the OAuth callback (same pattern as dear-neighbors magic link).
- A `client-metadata.json` must be hosted at a public URL. For MVP, host on GitHub Pages or add an endpoint to scenius-digest.

**Step 1: Research ATproto OAuth for Chrome extensions**

Before implementing, check the latest ATproto OAuth docs and any Chrome extension examples. The implementation will need:
- Handle resolution (`com.atproto.identity.resolveHandle`)
- Authorization server discovery
- PKCE OAuth flow
- Token storage in `chrome.storage.local`
- Refresh token rotation

**Step 2: Create `lib/atproto.js`**

OAuth client wrapper. Key exports: `resolveHandle(handle)`, `startAuth(handle)`, `handleCallback(params)`, `refreshSession()`, `getSession()`, `clearSession()`.

**Step 3: Rewrite `store/auth.js`**

Replace Supabase auth with ATproto:

```js
import { signal, computed } from '@preact/signals';

export const blueskyUser = signal(null); // { did, handle, displayName, avatar }
export const authLoading = signal(true);
export const isConnected = computed(() => blueskyUser.value !== null);

export async function initAuth() {
  // Check chrome.storage.local for saved session
  // If found, validate/refresh tokens
  // Set blueskyUser signal
  authLoading.value = false;
}

export async function connectBluesky(handle) {
  // Start OAuth flow
}

export async function disconnectBluesky() {
  blueskyUser.value = null;
  // Clear stored tokens
}
```

**Step 4: Update `background.js`**

Intercept ATproto OAuth callback redirects, forward to extension page.

**Step 5: Update `SettingsModal.jsx`**

Add Bluesky account section:
- Not connected: handle input + "Connect Bluesky" button
- Connected: avatar, handle, "Disconnect" button

**Step 6: Build, verify, commit**

```bash
npm run build
git add -A
git commit -m "Add ATproto OAuth authentication"
```

---

### Task 7: Bluesky Network Feed

Add the Bluesky timeline feed tab.

**Files:**
- Create: `extension/src/store/bluesky.js`
- Create: `extension/src/components/BlueskyFeed.jsx`
- Create: `extension/src/components/BlueskyPostCard.jsx`
- Create: `extension/src/styles/bluesky.css`
- Modify: `extension/src/components/SettingsModal.jsx` (feed picker)
- Modify: `extension/src/app.jsx`
- Modify: `extension/src/store/tabs.js` (hide network tab when not connected)

**Step 1: Create `store/bluesky.js`**

```js
import { signal } from '@preact/signals';

export const blueskyPosts = signal([]);
export const blueskyLoading = signal(false);
export const blueskyFeedUri = signal(localStorage.getItem('mc_bluesky_feed') || 'timeline');
export const blueskyTimeWindow = signal(localStorage.getItem('mc_bluesky_window') || '24h');

export async function loadBlueskyFeed(session) {
  // If blueskyFeedUri is 'timeline': fetch getTimeline, sort by engagement
  // Otherwise: fetch getFeed with the selected feed generator URI
}

export function setBlueskyFeedUri(uri) {
  blueskyFeedUri.value = uri;
  localStorage.setItem('mc_bluesky_feed', uri);
}

export function setBlueskyTimeWindow(window) {
  blueskyTimeWindow.value = window;
  localStorage.setItem('mc_bluesky_window', window);
}
```

**Step 2: Create `components/BlueskyPostCard.jsx`**

Display: avatar, handle, post text, embeds (images/links), engagement (likes/reposts/replies), timestamp. Click opens `https://bsky.app/profile/{handle}/post/{rkey}`.

**Step 3: Create `components/BlueskyFeed.jsx`**

```jsx
import { blueskyPosts, blueskyLoading, blueskyTimeWindow, setBlueskyTimeWindow } from '../store/bluesky';
import { BlueskyPostCard } from './BlueskyPostCard';

export function BlueskyFeed() {
  if (blueskyLoading.value) {
    return <div class="feed-empty">Loading Bluesky feed...</div>;
  }

  return (
    <div class="bluesky-feed">
      <div class="bluesky-controls">
        {['24h', '7d', '30d'].map((w) => (
          <button
            key={w}
            class={`tab-item ${blueskyTimeWindow.value === w ? 'active' : ''}`}
            onClick={() => setBlueskyTimeWindow(w)}
          >
            {w}
          </button>
        ))}
      </div>
      {blueskyPosts.value.length === 0 ? (
        <div class="feed-empty">No posts to show.</div>
      ) : (
        blueskyPosts.value.map((post) => (
          <BlueskyPostCard key={post.uri} post={post} />
        ))
      )}
    </div>
  );
}
```

**Step 4: Wire into `app.jsx`**

Conditionally show network tab only when Bluesky is connected. Load feed on tab activation.

**Step 5: Add feed picker to `SettingsModal.jsx`**

Dropdown showing "Popular from timeline" + user's subscribed feed generators.

**Step 6: Build, verify, commit**

```bash
npm run build
git add -A
git commit -m "Add Bluesky network feed"
```

---

### Task 8: Tab Visibility in Settings

Add toggles for each feed tab in settings modal.

**Files:**
- Modify: `extension/src/components/SettingsModal.jsx`
- Modify: `extension/src/store/tabs.js`

**Step 1: Add tab toggle section to SettingsModal**

Below communities, add checkboxes for Digest, Participation, Network (only if Bluesky connected).

```jsx
<section class="settings-section">
  <h4 class="settings-section-title">Visible Tabs</h4>
  {['digest', 'participation', 'network'].map((tab) => {
    if (tab === 'network' && !isConnected.value) return null;
    return (
      <label key={tab} class="settings-toggle-row">
        <span class="settings-toggle-label">{TAB_LABELS[tab]}</span>
        <label class="settings-toggle-switch">
          <input
            type="checkbox"
            checked={visibleTabs.value[tab]}
            onChange={(e) => setTabVisible(tab, e.target.checked)}
          />
          <span class="settings-toggle-track" />
        </label>
      </label>
    );
  })}
</section>
```

**Step 2: Build, verify, commit**

```bash
npm run build
git add -A
git commit -m "Add tab visibility toggles in settings"
```

---

### Task 9: Polish and CLAUDE.md

Final pass: empty states, caching, inline onboarding prompts, project documentation.

**Files:**
- Create: `C:/Users/temaz/claude-project/my-community/CLAUDE.md`
- Modify: various components for empty states

**Step 1: Write `CLAUDE.md`**

Document the project: overview, commands, architecture, stores, components, key constraints.

**Step 2: Add inline onboarding prompts**

When no communities selected, show prompt in dashboard area. When Bluesky not connected, show prompt in network tab area.

**Step 3: Final build and test**

```bash
cd C:/Users/temaz/claude-project/my-community/extension
npm run build
```

Load in Chrome. Test:
- Fresh install (no localStorage) → welcome prompt
- Select communities → digest feed loads
- Switch tabs → participation shows sessions
- Settings → all sections work
- Theme toggle works
- Dark mode works

**Step 4: Commit**

```bash
git add -A
git commit -m "Polish UI, add CLAUDE.md"
```

---

## Execution Notes

- **Tasks 1-5** are straightforward and can be done in sequence without blockers.
- **Task 6 (ATproto OAuth)** is the riskiest — Chrome extension OAuth has edge cases. Research at implementation time. May need to simplify to app password auth for MVP if OAuth proves too complex.
- **Task 7 (Bluesky feed)** depends on Task 6 completing successfully.
- **Tasks 8-9** are independent polish tasks.

**No tests configured** — dear-neighbors doesn't have a test framework, and this plan follows the same pattern. Quality is via build verification and manual testing in Chrome.
