import { topicEmoji } from '../store/digest';

export function DigestCard({ link }) {
  const domain = (() => {
    try { return new URL(link.url).hostname.replace('www.', ''); }
    catch { return ''; }
  })();

  return (
    <a class="digest-card" href={link.url} target="_blank" rel="noopener noreferrer">
      <div class="digest-card-header">
        <span class="digest-card-topic">{topicEmoji(link.topic)} {link.topic}</span>
        {link.shared_by && <span class="digest-card-sharer">via {link.shared_by}</span>}
      </div>
      <h4 class="digest-card-title">{link.title || link.url}</h4>
      {link.description && (
        <p class="digest-card-description">{link.description}</p>
      )}
      <div class="digest-card-footer">
        <span class="digest-card-domain">{domain}</span>
        <span class="digest-card-time">
          {new Date(link.shared_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      </div>
    </a>
  );
}
