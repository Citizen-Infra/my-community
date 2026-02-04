import { activeTab, setActiveTab, availableTabs } from '../store/tabs';
import '../styles/tabs.css';

const TAB_LABELS = {
  network: 'Bluesky',
  digest: 'Digest',
  participation: 'Participation',
};

export function TabBar() {
  const tabs = availableTabs.value;
  if (tabs.length <= 1) return null;

  return (
    <nav class="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab}
          class={`tab-item ${activeTab.value === tab ? 'active' : ''}`}
          onClick={() => setActiveTab(tab)}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </nav>
  );
}
