import { digestLinks, digestLoading, digestError, retryDigest } from '../store/digest';
import { DigestCard } from './DigestCard';
import { FeedError } from './FeedError';
import { caSignedIn } from '../store/caAuth';
import { deploymentConfig } from '../lib/deployment-config';
import '../styles/digest.css';

export function DigestFeed() {
  if (deploymentConfig.linksRequireSignIn && !caSignedIn.value) {
    return <div class="feed-empty">Sign in to see links shared by your community.</div>;
  }
  if (digestLoading.value) {
    return <div class="feed-empty">Loading the digest…</div>;
  }

  if (digestError.value && digestLinks.value.length === 0) {
    return <FeedError onRetry={retryDigest} />;
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
