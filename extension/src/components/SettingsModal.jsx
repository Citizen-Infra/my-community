import { useState, useEffect } from 'preact/hooks';
import { allCommunities, selectedCommunityIds, selectedCommunities, toggleCommunity, loadCommunities } from '../store/communities';
import { loadDigest } from '../store/digest';
import { loadSessions } from '../store/sessions';
import { caEmail, caSignedIn, requestSignIn, signOut } from '../store/caAuth';
import { theme, setTheme } from '../store/theme';
import { blueskyUser, isConnected, connectBluesky, disconnectBluesky } from '../store/auth';
import { blueskyShowReposts, setBlueskyShowReposts, blueskyWeightedSort, setBlueskyWeightedSort, loadBlueskyFeed, blueskyAvailableFeeds, blueskyFeedUri, setBlueskyFeedUri, loadSavedFeeds } from '../store/bluesky';
import { visibleTabs, setTabVisible, jamVisible, setJamVisible } from '../store/panels';
import { exportData } from '../lib/export';
import { clearAllData } from '../store/db';
import { activeCollectionId, loadCollections, getOrCreateArchive } from '../store/collections';
import { loadTabs } from '../store/tabs';
import { ImportModal } from './ImportModal';
import { BookmarkImportModal } from './BookmarkImportModal';
import { ConfirmDialog } from './ConfirmDialog';
import '../styles/settings-modal.css';
import '../styles/auth-modal.css';

export function SettingsModal({ onClose }) {
  const [activeSettingsTab, setActiveSettingsTab] = useState('dashboard');
  const [subModal, setSubModal] = useState(null);
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Community-admin (IdP) email sign-in
  const [caEmailInput, setCaEmailInput] = useState('');
  const [caError, setCaError] = useState(null);
  const [caSubmitting, setCaSubmitting] = useState(false);
  const [caLinkSent, setCaLinkSent] = useState(false);

  // Tab-manager save behavior (persisted in chrome.storage.local, read by the worker)
  const [toolbarTarget, setToolbarTarget] = useState('saved-tabs');
  const [shortcutTarget, setShortcutTarget] = useState('most-recent');
  const [dailyBackup, setDailyBackup] = useState(true);
  const [backupInterval, setBackupInterval] = useState('1440');
  const [showClear, setShowClear] = useState(false);

  useEffect(() => {
    chrome.storage?.local?.get([
      'tab-hoarder-toolbar-target',
      'tab-hoarder-shortcut-target',
      'tab-hoarder-daily-backup',
      'tab-hoarder-backup-interval',
    ], (result) => {
      if (result['tab-hoarder-toolbar-target']) setToolbarTarget(result['tab-hoarder-toolbar-target']);
      if (result['tab-hoarder-shortcut-target']) setShortcutTarget(result['tab-hoarder-shortcut-target']);
      if (result['tab-hoarder-daily-backup'] !== undefined) setDailyBackup(result['tab-hoarder-daily-backup'] !== false);
      if (result['tab-hoarder-backup-interval']) setBackupInterval(result['tab-hoarder-backup-interval']);
    });
  }, []);

  const updateToolbarTarget = (val) => {
    setToolbarTarget(val);
    chrome.storage?.local?.set({ 'tab-hoarder-toolbar-target': val });
  };
  const updateShortcutTarget = (val) => {
    setShortcutTarget(val);
    chrome.storage?.local?.set({ 'tab-hoarder-shortcut-target': val });
  };
  const updateDailyBackup = (val) => {
    setDailyBackup(val);
    chrome.storage?.local?.set({ 'tab-hoarder-daily-backup': val });
  };
  const updateBackupInterval = (val) => {
    setBackupInterval(val);
    chrome.storage?.local?.set({ 'tab-hoarder-backup-interval': val });
  };

  async function handleClearAll() {
    try {
      await clearAllData();
      activeCollectionId.value = null;
      await loadCollections();
      await loadTabs();
      await getOrCreateArchive();
    } catch (err) {
      console.error('My Community: clear all data failed', err);
    }
    setShowClear(false);
  }

  async function handleConnect(e) {
    e.preventDefault();
    if (!handle.trim() || !appPassword.trim()) return;
    setAuthError(null);
    setConnecting(true);
    try {
      await connectBluesky(handle.trim(), appPassword.trim());
      setHandle('');
      setAppPassword('');
      await loadSavedFeeds();
    } catch (err) {
      setAuthError(err.message);
    }
    setConnecting(false);
  }

  async function handleCaSignIn(e) {
    e.preventDefault();
    if (!caEmailInput.trim()) return;
    setCaError(null);
    setCaSubmitting(true);
    try {
      await requestSignIn(caEmailInput.trim());
      setCaLinkSent(true);
      setCaEmailInput('');
    } catch (err) {
      setCaError(err.message);
    }
    setCaSubmitting(false);
  }

  async function handleCaSignOut() {
    signOut();
    await loadCommunities();
    if (selectedCommunityIds.value.length > 0) {
      loadDigest(selectedCommunityIds.value);
      loadSessions(selectedCommunities.value);
    }
  }

  return (
    <>
      <div class="modal-overlay" onClick={onClose}>
        <div class="settings-modal" onClick={(e) => e.stopPropagation()}>
          <div class="settings-header">
            <h3 class="settings-title">Settings</h3>
            <button class="settings-close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>

          <div class="settings-tabs" role="tablist">
            <button
              class={`settings-tab ${activeSettingsTab === 'dashboard' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeSettingsTab === 'dashboard'}
              onClick={() => setActiveSettingsTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              class={`settings-tab ${activeSettingsTab === 'tab-manager' ? 'active' : ''}`}
              role="tab"
              aria-selected={activeSettingsTab === 'tab-manager'}
              onClick={() => setActiveSettingsTab('tab-manager')}
            >
              Tab Manager
            </button>
          </div>

          {activeSettingsTab === 'dashboard' && (
            <>
              {/* Bluesky Section */}
              <section class="settings-section">
                <div class="settings-section-header">
                  <h4 class="settings-section-title">Bluesky</h4>
                  {isConnected.value && (
                    <label class="settings-toggle-inline">
                      <input
                        type="checkbox"
                        checked={visibleTabs.value.network}
                        onChange={(e) => setTabVisible('network', e.target.checked)}
                      />
                      <span class="settings-toggle-track-sm" />
                    </label>
                  )}
                </div>

                {isConnected.value ? (
                  <div class="settings-card">
                    <div class="settings-card-header">
                      <span class="settings-card-status">
                        <span class="status-dot" />
                        @{blueskyUser.value.handle}
                      </span>
                      <button class="settings-link-btn" onClick={disconnectBluesky}>
                        Disconnect
                      </button>
                    </div>

                    {blueskyAvailableFeeds.value.length > 1 && (
                      <div class="settings-field">
                        <label class="settings-label">Feed</label>
                        <select
                          class="location-select"
                          value={blueskyFeedUri.value}
                          onChange={(e) => {
                            setBlueskyFeedUri(e.target.value);
                            loadBlueskyFeed();
                          }}
                        >
                          {blueskyAvailableFeeds.value.map((feed) => (
                            <option key={feed.uri} value={feed.uri}>
                              {feed.type === 'list' ? `List: ${feed.name}` : feed.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div class="settings-toggles">
                      <label class="settings-toggle-compact">
                        <span>Show reposts</span>
                        <label class="settings-toggle-switch">
                          <input
                            type="checkbox"
                            checked={blueskyShowReposts.value}
                            onChange={(e) => {
                              setBlueskyShowReposts(e.target.checked);
                              loadBlueskyFeed();
                            }}
                          />
                          <span class="settings-toggle-track" />
                        </label>
                      </label>
                      <label class="settings-toggle-compact">
                        <span>Weighted engagement</span>
                        <label class="settings-toggle-switch">
                          <input
                            type="checkbox"
                            checked={blueskyWeightedSort.value}
                            onChange={(e) => {
                              setBlueskyWeightedSort(e.target.checked);
                              loadBlueskyFeed();
                            }}
                          />
                          <span class="settings-toggle-track" />
                        </label>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div class="settings-card settings-card-empty">
                    <p class="settings-card-desc">
                      Connect to see popular posts from your network.
                    </p>
                    <form onSubmit={handleConnect} class="auth-form-compact">
                      <input
                        type="text"
                        class="auth-input"
                        placeholder="Handle (e.g. alice.bsky.social)"
                        value={handle}
                        onInput={(e) => setHandle(e.target.value)}
                        required
                      />
                      <input
                        type="password"
                        class="auth-input"
                        placeholder="App Password"
                        value={appPassword}
                        onInput={(e) => setAppPassword(e.target.value)}
                        required
                      />
                      {authError && <p class="auth-error">{authError}</p>}
                      <button type="submit" class="auth-submit" disabled={connecting}>
                        {connecting ? 'Connecting...' : 'Connect'}
                      </button>
                    </form>
                    <p class="settings-hint">
                      <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener">
                        Create an app password
                      </a> at bsky.app
                    </p>
                  </div>
                )}
              </section>

              {/* Community Account Section */}
              <section class="settings-section">
                <h4 class="settings-section-title">Community account</h4>
                {caSignedIn.value ? (
                  <div class="settings-card">
                    <div class="settings-card-header">
                      <span class="settings-card-status">
                        <span class="status-dot" />
                        {caEmail.value}
                      </span>
                      <button class="settings-link-btn" onClick={handleCaSignOut}>
                        Sign out
                      </button>
                    </div>
                  </div>
                ) : caLinkSent ? (
                  <div class="settings-card settings-card-empty">
                    <p class="settings-card-desc">
                      Check your email for a sign-in link.
                    </p>
                  </div>
                ) : (
                  <div class="settings-card settings-card-empty">
                    <p class="settings-card-desc">
                      Sign in to see communities you're a member of.
                    </p>
                    <form onSubmit={handleCaSignIn} class="auth-form-compact">
                      <input
                        type="email"
                        class="auth-input"
                        placeholder="you@example.com"
                        value={caEmailInput}
                        onInput={(e) => setCaEmailInput(e.target.value)}
                        required
                      />
                      {caError && <p class="auth-error">{caError}</p>}
                      <button type="submit" class="auth-submit" disabled={caSubmitting}>
                        {caSubmitting ? 'Sending...' : 'Send magic link'}
                      </button>
                    </form>
                  </div>
                )}
              </section>

              {/* Communities Section */}
              <section class="settings-section">
                <h4 class="settings-section-title">Communities</h4>
                <div class="settings-card">
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
                    <p class="settings-hint" style="margin-top: 0;">Loading communities...</p>
                  )}
                </div>
              </section>

              {/* Digest Section */}
              <section class="settings-section">
                <div class="settings-section-header">
                  <h4 class="settings-section-title">Digest</h4>
                  <label class="settings-toggle-inline">
                    <input
                      type="checkbox"
                      checked={visibleTabs.value.digest}
                      onChange={(e) => setTabVisible('digest', e.target.checked)}
                    />
                    <span class="settings-toggle-track-sm" />
                  </label>
                </div>
                <p class="settings-hint" style="margin-top: 0;">
                  Curated links from community Telegram groups.
                </p>
              </section>

              {/* Participation Section */}
              <section class="settings-section">
                <div class="settings-section-header">
                  <h4 class="settings-section-title">Participation</h4>
                  <label class="settings-toggle-inline">
                    <input
                      type="checkbox"
                      checked={visibleTabs.value.participation}
                      onChange={(e) => setTabVisible('participation', e.target.checked)}
                    />
                    <span class="settings-toggle-track-sm" />
                  </label>
                </div>
                <p class="settings-hint" style="margin-top: 0;">
                  Sessions and events from your selected communities.
                </p>
              </section>

              {/* Jam Section — global "now listening" strip */}
              <section class="settings-section">
                <div class="settings-section-header">
                  <h4 class="settings-section-title">Jam</h4>
                  <label class="settings-toggle-inline">
                    <input
                      type="checkbox"
                      checked={jamVisible.value}
                      onChange={(e) => setJamVisible(e.target.checked)}
                    />
                    <span class="settings-toggle-track-sm" />
                  </label>
                </div>
                <p class="settings-hint" style="margin-top: 0;">
                  Live listening rooms, shown across the top of every screen when one is active.
                </p>
              </section>

              {/* Appearance Section */}
              <section class="settings-section">
                <h4 class="settings-section-title">Appearance</h4>
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
            </>
          )}

          {activeSettingsTab === 'tab-manager' && (
            <>
              {/* Save Behavior Section (tab manager) */}
              <section class="settings-section">
                <h4 class="settings-section-title">Save Behavior</h4>
                <div class="settings-card">
                  <div class="settings-field">
                    <label class="settings-label">Toolbar icon saves to</label>
                    <div class="theme-picker">
                      {[['saved-tabs', 'Saved Tabs'], ['most-recent', 'Most recent']].map(([val, label]) => (
                        <button
                          key={val}
                          class={`topic-grid-chip ${toolbarTarget === val ? 'active' : ''}`}
                          onClick={() => updateToolbarTarget(val)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div class="settings-field" style="margin-top: var(--space-md);">
                    <label class="settings-label">Alt+S shortcut saves to</label>
                    <div class="theme-picker">
                      {[['most-recent', 'Most recent'], ['saved-tabs', 'Saved Tabs']].map(([val, label]) => (
                        <button
                          key={val}
                          class={`topic-grid-chip ${shortcutTarget === val ? 'active' : ''}`}
                          onClick={() => updateShortcutTarget(val)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p class="settings-hint">
                    Set the keyboard shortcut at{' '}
                    <button
                      class="settings-link-btn"
                      onClick={() => chrome.tabs?.create({ url: 'chrome://extensions/shortcuts' })}
                    >
                      chrome://extensions/shortcuts
                    </button>.
                  </p>
                </div>
              </section>

              {/* Data Section — export + import (previously unreachable) */}
              <section class="settings-section">
                <h4 class="settings-section-title">Data</h4>
                <div class="settings-data-actions">
                  <button class="settings-data-btn" onClick={() => exportData()}>
                    <span>Export all</span>
                    <span class="settings-data-btn-arrow" aria-hidden="true">↓</span>
                  </button>
                  {activeCollectionId.value && (
                    <button class="settings-data-btn" onClick={() => exportData(activeCollectionId.value)}>
                      <span>Export current collection</span>
                      <span class="settings-data-btn-arrow" aria-hidden="true">↓</span>
                    </button>
                  )}
                  <button class="settings-data-btn" onClick={() => setSubModal('import')}>
                    <span>Import tabs</span>
                    <span class="settings-data-btn-arrow" aria-hidden="true">↑</span>
                  </button>
                  <button class="settings-data-btn" onClick={() => setSubModal('bookmarks')}>
                    <span>Import bookmarks</span>
                    <span class="settings-data-btn-arrow" aria-hidden="true">↑</span>
                  </button>
                </div>
                <p class="settings-hint">
                  Export downloads a JSON of your tabs and collections. Import accepts a Toby or Tab Hoarder export, or your browser bookmarks.
                </p>
                <div class="settings-data-actions" style="margin-top: var(--space-md);">
                  <button class="settings-data-btn danger" onClick={() => setShowClear(true)}>
                    <span>Clear all data</span>
                  </button>
                </div>
              </section>

              {/* Backups Section */}
              <section class="settings-section">
                <div class="settings-section-header">
                  <h4 class="settings-section-title">Backups</h4>
                  <label class="settings-toggle-inline">
                    <input
                      type="checkbox"
                      checked={dailyBackup}
                      onChange={(e) => updateDailyBackup(e.target.checked)}
                    />
                    <span class="settings-toggle-track-sm" />
                  </label>
                </div>
                {dailyBackup ? (
                  <div class="settings-card">
                    <div class="settings-field">
                      <label class="settings-label">Frequency</label>
                      <div class="theme-picker">
                        {[['720', '12h'], ['1440', 'Daily'], ['4320', '3 days'], ['10080', 'Weekly']].map(([val, label]) => (
                          <button
                            key={val}
                            class={`topic-grid-chip ${backupInterval === val ? 'active' : ''}`}
                            onClick={() => updateBackupInterval(val)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p class="settings-hint">
                      Automatic JSON backups to your Downloads/TabHoarder/ folder.
                    </p>
                  </div>
                ) : (
                  <p class="settings-hint" style="margin-top: 0;">
                    Turn on to keep automatic JSON backups in your Downloads/TabHoarder/ folder.
                  </p>
                )}
              </section>
            </>
          )}

          <footer class="settings-about">
            Built by <a href="https://github.com/Citizen-Infra" target="_blank" rel="noopener">Citizen Infra</a>
          </footer>
        </div>
      </div>

      {subModal === 'import' && <ImportModal onClose={() => setSubModal(null)} />}
      {subModal === 'bookmarks' && <BookmarkImportModal onClose={() => setSubModal(null)} />}
      {showClear && (
        <ConfirmDialog
          title="Clear all data?"
          message="This permanently deletes all your saved tabs and collections. This cannot be undone."
          confirmLabel="Clear everything"
          danger
          onConfirm={handleClearAll}
          onCancel={() => setShowClear(false)}
        />
      )}
    </>
  );
}
