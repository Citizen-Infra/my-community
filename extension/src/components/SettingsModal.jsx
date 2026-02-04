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
