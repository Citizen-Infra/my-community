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
