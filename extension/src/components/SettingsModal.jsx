import { useState } from 'preact/hooks';
import { allCommunities, selectedCommunityIds, toggleCommunity } from '../store/communities';
import { theme, setTheme } from '../store/theme';
import { blueskyUser, isConnected, connectBluesky, disconnectBluesky } from '../store/auth';
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

        <section class="settings-section">
          <h4 class="settings-section-title">Bluesky Account</h4>
          {isConnected.value ? (
            <div class="auth-inline">
              <p class="auth-inline-status">
                Connected as <strong>@{blueskyUser.value.handle}</strong>
              </p>
              <button class="auth-inline-signout" onClick={disconnectBluesky}>
                Disconnect
              </button>
            </div>
          ) : (
            <div class="auth-inline">
              <p class="settings-hint" style="margin-top: 0;">
                Connect your Bluesky account to see popular posts from your network.
              </p>
              <form onSubmit={handleConnect}>
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
                  {connecting ? 'Connecting...' : 'Connect Bluesky'}
                </button>
                <p class="settings-hint" style="margin-top: 0.5rem;">
                  <a href="https://bsky.app/settings/app-passwords" target="_blank" rel="noopener">
                    Create an app password
                  </a> at bsky.app
                </p>
              </form>
            </div>
          )}
        </section>

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
          <h4 class="settings-section-title">Visible Tabs</h4>
          {[
            { key: 'digest', label: 'Digest' },
            { key: 'participation', label: 'Participation' },
            { key: 'network', label: 'Bluesky' },
          ].map(({ key, label }) => {
            if (key === 'network' && !isConnected.value) return null;
            return (
              <label key={key} class="settings-toggle-row">
                <span class="settings-toggle-label">{label}</span>
                <label class="settings-toggle-switch">
                  <input
                    type="checkbox"
                    checked={visibleTabs.value[key]}
                    onChange={(e) => setTabVisible(key, e.target.checked)}
                  />
                  <span class="settings-toggle-track" />
                </label>
              </label>
            );
          })}
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
