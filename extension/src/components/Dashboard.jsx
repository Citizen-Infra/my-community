import { communitiesConfigured } from '../store/communities';
import { activeTab, dashboardMode, showDashboardOverview } from '../store/panels';
import { DashboardOverview, DASHBOARD_FEED_LABELS } from './DashboardOverview';
import { DigestFeed } from './DigestFeed';
import { SessionsPanel } from './SessionsPanel';
import { BlueskyFeed } from './BlueskyFeed';
import { CommunityInputFeed } from './CommunityInputFeed';

export function Dashboard() {
  if (!communitiesConfigured.value) {
    return (
      <main class="dashboard">
        <div class="welcome-prompt">
          <h2>Welcome to My Community</h2>
          <p>Select your communities to start seeing digest links, sessions, and events.</p>
          <p class="welcome-hint">Click the gear icon above to get started.</p>
        </div>
      </main>
    );
  }

  if (dashboardMode.value === 'overview') {
    return <DashboardOverview />;
  }

  return (
    <>
      <header class="dashboard-feed-header">
        <button type="button" class="dashboard-feed-back" onClick={showDashboardOverview}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 12H5m6-6-6 6 6 6" />
          </svg>
          Overview
        </button>
        <h2>{DASHBOARD_FEED_LABELS[activeTab.value]}</h2>
      </header>
      <main class="dashboard">
        {activeTab.value === 'digest' && <DigestFeed />}
        {activeTab.value === 'participation' && <SessionsPanel />}
        {activeTab.value === 'network' && <BlueskyFeed />}
        {activeTab.value === 'communityInput' && <CommunityInputFeed />}
      </main>
    </>
  );
}
