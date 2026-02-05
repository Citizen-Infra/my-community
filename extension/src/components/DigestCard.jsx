import { useState } from 'preact/hooks';
import { topicEmoji } from '../store/digest';
import { allCommunities } from '../store/communities';
import { isConnected } from '../store/auth';

// Warm, editorial color palette for communities
const COMMUNITY_COLORS = {
  scenius: { bg: '#fef3e2', border: '#e8a33c', text: '#a16207' },
  cibc: { bg: '#e8f4f0', border: '#3d9970', text: '#1a5f45' },
  harmonica: { bg: '#f0e8f5', border: '#8b5cb5', text: '#5b3a7a' },
  ofl: { bg: '#e8f0f8', border: '#4a7fba', text: '#2d5a8a' },
};

// Fallback colors for unknown communities
const FALLBACK_COLORS = [
  { bg: '#fce8e8', border: '#c45c5c', text: '#8b3a3a' },
  { bg: '#e8f8f0', border: '#4ab586', text: '#2a7a56' },
  { bg: '#f8f0e8', border: '#ba8a4a', text: '#7a5a2a' },
  { bg: '#e8e8f8', border: '#6a6aba', text: '#4a4a8a' },
];

function getCommunityColors(communityId) {
  if (COMMUNITY_COLORS[communityId]) {
    return COMMUNITY_COLORS[communityId];
  }
  // Deterministic fallback based on community ID
  const hash = communityId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function DigestCard({ link }) {
  const [imgError, setImgError] = useState(false);

  const domain = (() => {
    try { return new URL(link.url).hostname.replace('www.', ''); }
    catch { return ''; }
  })();

  const title = link.og_title || link.title || link.url;
  const description = link.og_description || link.description;
  const image = (!imgError && link.og_image) ? link.og_image : null;

  const community = allCommunities.value.find(c => c.id === link.community_id);
  const communityName = community?.name || link.community_id;
  const colors = getCommunityColors(link.community_id);

  function handleShare(e) {
    e.preventDefault();
    e.stopPropagation();
    const text = `${title}\n\n${link.url}\n\n— shared via My Community`;
    const intentUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <a
      class={`digest-card ${image ? 'has-thumb' : ''}`}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ '--community-border': colors.border, '--community-bg': colors.bg, '--community-text': colors.text }}
    >
      <div class="digest-card-accent" />
      <div class="digest-card-body">
        <div class="digest-card-header">
          <div class="digest-card-meta">
            <span class="digest-card-community">{communityName}</span>
            <span class="digest-card-topic">{topicEmoji(link.topic)} {link.topic}</span>
          </div>
          {link.shared_by && <span class="digest-card-sharer">via {link.shared_by}</span>}
        </div>
        <h4 class="digest-card-title">{title}</h4>
        {description && (
          <p class="digest-card-description">{description}</p>
        )}
        <div class="digest-card-footer">
          <span class="digest-card-domain">{domain}</span>
          <div class="digest-card-footer-right">
            <span class="digest-card-time">
              {new Date(link.shared_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {isConnected.value && (
              <button
                class="digest-card-share"
                onClick={handleShare}
                title="Share to Bluesky"
                aria-label="Share to Bluesky"
              >
                <svg class="share-icon" width="14" height="14" viewBox="0 0 600 530" fill="currentColor">
                  <path d="m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z"/>
                </svg>
                <span class="share-label">Share</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {image && (
        <div class="digest-card-thumb">
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
          />
        </div>
      )}
    </a>
  );
}
