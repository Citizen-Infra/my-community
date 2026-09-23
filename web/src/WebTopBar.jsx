import { selectedCommunities } from '../../extension/src/store/communities';
import { dashboardCustomizing, toggleDashboardCustomization } from '../../extension/src/store/panels';
import { preferenceMessage, preferenceStatus, retryPreferenceSync } from '../../extension/src/store/preferences';
import { caSignedIn } from '../../extension/src/store/caAuth';
import { deploymentConfig } from '../../extension/src/lib/deployment-config';
import { DeploymentMark } from './DeploymentMark';

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1.03H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z" /></svg>
  );
}

export function WebTopBar({ online, onOpenSettings, onOpenOverview }) {
  const communities = selectedCommunities.value;
  const syncNeedsAction = ['error', 'conflict'].includes(preferenceStatus.value);
  return (
    <header class="web-topbar">
      <div class="web-topbar-inner">
        <a class="web-wordmark" href="/" onClick={(event) => { event.preventDefault(); onOpenOverview(); }} aria-label={`${deploymentConfig.brand.name} overview`}>
          {deploymentConfig.brand.id === 'philanthropic-xxi' && <DeploymentMark />}
          <span>{deploymentConfig.brand.name}</span>
        </a>
        <div class="web-community-context" aria-label="Selected communities">
          {!deploymentConfig.pinnedCommunityId && communities.slice(0, 2).map((community) => <span key={community.id}>{community.name}</span>)}
          {!deploymentConfig.pinnedCommunityId && communities.length > 2 && <span>+{communities.length - 2}</span>}
        </div>
        <div class="web-topbar-actions">
          <button
            type="button"
            class={`web-sync-status state-${preferenceStatus.value}`}
            onClick={syncNeedsAction ? retryPreferenceSync : undefined}
            title={preferenceMessage.value}
            disabled={!syncNeedsAction}
            aria-live="polite"
          >
            <span class="web-status-dot" aria-hidden="true" />
            {!online ? 'Offline' : caSignedIn.value ? preferenceMessage.value : 'On this device'}
          </button>
          <button type="button" class={`web-icon-button ${dashboardCustomizing.value ? 'active' : ''}`} onClick={toggleDashboardCustomization} aria-label="Customize dashboard" aria-pressed={dashboardCustomizing.value}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7" /><circle cx="9" cy="7" r="2" /><line x1="4" y1="17" x2="20" y2="17" /><circle cx="15" cy="17" r="2" /></svg>
          </button>
          <button type="button" class="web-icon-button" onClick={onOpenSettings} aria-label="Open settings"><SettingsIcon /></button>
        </div>
      </div>
    </header>
  );
}
