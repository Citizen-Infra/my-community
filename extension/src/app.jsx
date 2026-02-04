import { useEffect, useState } from 'preact/hooks';
import { initTheme } from './store/theme';
import { TopBar } from './components/TopBar';
import './styles/layout.css';

export function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initTheme();
    setReady(true);
  }, []);

  if (!ready) {
    return <div class="loading-screen"><p>Loading...</p></div>;
  }

  return (
    <div class="app">
      <TopBar />
      <main class="dashboard">
        <p style="padding: 2rem; opacity: 0.5;">My Community — coming soon</p>
      </main>
    </div>
  );
}
