import { useState } from 'preact/hooks';
import { SettingsModal } from './SettingsModal';
import { SearchBar } from './SearchBar';
import { tabManagerEnabled } from '../store/tab-manager';
import {
  availableTabs,
  dashboardCustomizing,
  toggleDashboardCustomization,
} from '../store/panels';
import '../styles/topbar.css';

export function TopBar() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <header class="topbar">
      <div class={`topbar-inner ${tabManagerEnabled.value ? '' : 'dashboard-only'}`}>
        <div class="topbar-brand">
          <h1 class="topbar-title">My Community</h1>
        </div>

        {tabManagerEnabled.value && <SearchBar />}

        <div class="topbar-actions">
          {!tabManagerEnabled.value && (
            <button
              type="button"
              class={`topbar-gear topbar-customize ${dashboardCustomizing.value ? 'active' : ''}`}
              onClick={toggleDashboardCustomization}
              disabled={availableTabs.value.length === 0}
              aria-label="Customize dashboard"
              aria-pressed={dashboardCustomizing.value}
              title="Customize dashboard"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="4" y1="7" x2="20" y2="7" />
                <circle cx="9" cy="7" r="2" fill="var(--color-surface)" />
                <line x1="4" y1="17" x2="20" y2="17" />
                <circle cx="15" cy="17" r="2" fill="var(--color-surface)" />
              </svg>
            </button>
          )}
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
