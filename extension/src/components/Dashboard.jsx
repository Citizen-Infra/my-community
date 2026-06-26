import { communitiesConfigured } from '../store/communities';
import { isConnected } from '../store/auth';
import { activeTab } from '../store/panels';
import { TabBar } from './TabBar';
import { DigestFeed } from './DigestFeed';
import { SessionsPanel } from './SessionsPanel';
import { BlueskyFeed } from './BlueskyFeed';

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
        {activeTab.value === 'network' && (
          isConnected.value ? (
            <BlueskyFeed />
          ) : (
            <div class="bsky-connect-prompt">
              <p>Connect your Bluesky account to see your network feed.</p>
              <p class="bsky-connect-hint">Open Settings to connect with an app password.</p>
            </div>
          )
        )}
      </main>
    </>
  );
}
