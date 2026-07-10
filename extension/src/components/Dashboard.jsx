import { communitiesConfigured } from '../store/communities';
import { activeTab } from '../store/panels';
import { TabBar } from './TabBar';
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

  return (
    <>
      <TabBar />
      <main class="dashboard">
        {activeTab.value === 'digest' && <DigestFeed />}
        {activeTab.value === 'participation' && <SessionsPanel />}
        {activeTab.value === 'network' && <BlueskyFeed />}
        {activeTab.value === 'communityInput' && <CommunityInputFeed />}
      </main>
    </>
  );
}
