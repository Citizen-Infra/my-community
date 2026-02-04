import { useState } from 'preact/hooks';
import { topicEmoji } from '../store/digest';

export function DigestCard({ link }) {
  const [imgError, setImgError] = useState(false);

  const domain = (() => {
    try { return new URL(link.url).hostname.replace('www.', ''); }
    catch { return ''; }
  })();

  const title = link.og_title || link.title || link.url;
  const description = link.og_description || link.description;
  const image = (!imgError && link.og_image) ? link.og_image : null;

  return (
    <a class={`digest-card ${image ? 'has-thumb' : ''}`} href={link.url} target="_blank" rel="noopener noreferrer">
      <div class="digest-card-body">
        <div class="digest-card-header">
          <span class="digest-card-topic">{topicEmoji(link.topic)} {link.topic}</span>
          {link.shared_by && <span class="digest-card-sharer">via {link.shared_by}</span>}
        </div>
        <h4 class="digest-card-title">{title}</h4>
        {description && (
          <p class="digest-card-description">{description}</p>
        )}
        <div class="digest-card-footer">
          <span class="digest-card-domain">{domain}</span>
          <span class="digest-card-time">
            {new Date(link.shared_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
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
