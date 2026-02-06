import { useState } from 'preact/hooks';
import { allCommunities, selectedCommunityIds, toggleCommunity } from '../store/communities';
import { theme, setTheme } from '../store/theme';
import { blueskyUser, isConnected, connectBluesky, disconnectBluesky } from '../store/auth';
import { blueskyShowReposts, setBlueskyShowReposts, blueskyWeightedSort, setBlueskyWeightedSort, loadBlueskyFeed, blueskyAvailableFeeds, blueskyFeedUri, setBlueskyFeedUri, loadSavedFeeds } from '../store/bluesky';
import { visibleTabs, setTabVisible } from '../store/tabs';
import '../styles/settings-modal.css';
import '../styles/auth-modal.css';

export function SettingsModal({ onClose }) {
  const [handle, setHandle] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState(null);

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

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div class="settings-header">
          <h3 class="settings-title">Settings</h3>
          <button class="settings-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

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

          <div class="settings-card">
            <label class="settings-label" style="margin-top: 0;">Communities</label>
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
            Shows sessions and events from your selected communities.
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

        <footer class="settings-about">
          Built by <a href="https://github.com/Citizen-Infra" target="_blank" rel="noopener">Citizen Infra</a>
        </footer>
      </div>
    </div>
  );
}
