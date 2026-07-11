import { activeTab, setActiveTab, availableTabs } from '../store/panels';
import { openUnvotedCount } from '../store/proposals';
import '../styles/tabs.css';

const TAB_LABELS = {
  network: 'Network',
  digest: 'Digest',
  participation: 'Participation',
  communityInput: 'Community Input',
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
          {tab === 'communityInput' && openUnvotedCount.value > 0 && (
            <span class="tab-badge">{openUnvotedCount.value}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
