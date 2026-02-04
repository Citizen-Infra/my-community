import { digestLinks, digestLoading } from '../store/digest';
import { DigestCard } from './DigestCard';
import '../styles/digest.css';

export function DigestFeed() {
  if (digestLoading.value) {
    return <div class="feed-empty">Loading digest...</div>;
  }

  if (digestLinks.value.length === 0) {
    return (
      <div class="feed-empty">
        No recent links from your communities.
      </div>
    );
  }

  return (
    <div class="digest-feed">
      {digestLinks.value.map((link) => (
        <DigestCard key={link.id} link={link} />
      ))}
    </div>
  );
}
