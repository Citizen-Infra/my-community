import { activeTab, setActiveTab, availableTabs } from '../store/panels';
import { openUnvotedCount } from '../store/proposals';
import { openUnvotedKnowledgeCount } from '../store/knowledge';
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

  // Things awaiting the member's input across both kinds: open decisions and
  // sources still gathering support.
  const inputBadge = openUnvotedCount.value + openUnvotedKnowledgeCount.value;

  return (
    <nav class="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab}
          class={`tab-item ${activeTab.value === tab ? 'active' : ''}`}
          onClick={() => setActiveTab(tab)}
        >
          {TAB_LABELS[tab]}
          {tab === 'communityInput' && inputBadge > 0 && (
            <span class="tab-badge">{inputBadge}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
