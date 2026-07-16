import { toggleLike } from '../store/bluesky';
import { segmentText } from '../lib/richtext';

export function BlueskyPostCard({ post }) {
  const rkey = post.uri.split('/').pop();
  const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
  const profileUrl = `https://bsky.app/profile/${post.author.handle}`;
  const timeAgo = getRelativeTime(post.createdAt);
  const repostedBy = post.reason?.by?.displayName || post.reason?.by?.handle;
  const isLiked = !!post.viewer?.like;

  return (
    <article class="bsky-card">
      {repostedBy && (
        <div class="bsky-repost-label">Reposted by {repostedBy}</div>
      )}
      <div class="bsky-card-header">
        {post.author.avatar ? (
          <img class="bsky-avatar" src={post.author.avatar} alt="" />
        ) : (
          <div class="bsky-avatar bsky-avatar-placeholder" />
        )}
        <div class="bsky-author">
          <a class="bsky-display-name bsky-child-link" href={profileUrl} target="_blank" rel="noopener noreferrer">
            {post.author.displayName}
          </a>
          <span class="bsky-handle">@{post.author.handle}</span>
        </div>
        {/* The timestamp is the card's primary link; its ::after stretches over the
            whole card so a click on empty space opens the post. Child links sit above it. */}
        <a class="bsky-time bsky-card-link" href={postUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open post, ${timeAgo} old`}>
          {timeAgo}
        </a>
      </div>

      {post.text && (
        <p class="bsky-text"><RichText text={post.text} facets={post.facets} /></p>
      )}

      <EmbedContent embed={post.embed} />

      <div class="bsky-stats">
        <span class="bsky-stat">{post.replyCount} replies</span>
        <span class="bsky-stat">{post.repostCount} reposts</span>
        <button
          class={`bsky-like-btn bsky-child-link${isLiked ? ' liked' : ''}`}
          onClick={() => toggleLike(post)}
          title={isLiked ? 'Unlike' : 'Like'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {post.likeCount}
        </button>
      </div>
    </article>
  );
}

// Renders post text with facets. Links/mentions/tags become real anchors, except
// in `plain` mode (used inside the quote block, which is itself a link — nested
// anchors are invalid, so there they render as styled, non-interactive spans).
function RichText({ text, facets, plain }) {
  const segments = segmentText(text, facets);
  return segments.map((seg, i) => {
    if (!seg.facet) return seg.text;
    const href = facetHref(seg.facet);
    if (!href || plain) return <span key={i} class="bsky-link">{seg.text}</span>;
    return (
      <a key={i} class="bsky-link bsky-child-link" href={href} target="_blank" rel="noopener noreferrer">
        {seg.text}
      </a>
    );
  });
}

function facetHref(facet) {
  if (facet.type === 'link') return facet.value;
  if (facet.type === 'mention') return `https://bsky.app/profile/${facet.value}`;
  if (facet.type === 'tag') return `https://bsky.app/hashtag/${encodeURIComponent(facet.value)}`;
  return null;
}

// Dispatch on the embed view type. Video + galleries are deferred to a follow-up,
// so they render a small hint rather than nothing (the card link opens the post).
function EmbedContent({ embed }) {
  if (!embed) return null;
  switch (embed.$type) {
    case 'app.bsky.embed.images#view':
      return <PostImages images={embed.images} />;
    case 'app.bsky.embed.external#view':
      return <ExternalCard external={embed.external} />;
    case 'app.bsky.embed.record#view':
      return <QuoteBlock record={embed.record} />;
    case 'app.bsky.embed.recordWithMedia#view':
      return (
        <>
          <MediaView media={embed.media} />
          <QuoteBlock record={embed.record?.record} />
        </>
      );
    case 'app.bsky.embed.video#view':
      return <MediaHint label="Video" />;
    default:
      return <MediaHint label="Media" />;
  }
}

function MediaView({ media }) {
  if (!media) return null;
  if (media.$type === 'app.bsky.embed.images#view') return <PostImages images={media.images} />;
  if (media.$type === 'app.bsky.embed.external#view') return <ExternalCard external={media.external} />;
  if (media.$type === 'app.bsky.embed.video#view') return <MediaHint label="Video" />;
  return <MediaHint label="Media" />;
}

function PostImages({ images, small }) {
  if (!images || images.length === 0) return null;
  const shown = images.slice(0, 4);
  const cls = `bsky-images${shown.length > 1 ? ' bsky-images-grid' : ''}${small ? ' bsky-images-small' : ''}`;
  return (
    <div class={cls}>
      {shown.map((img, i) => (
        <img
          key={i}
          class="bsky-image"
          src={img.thumb || img.fullsize}
          alt={img.alt || ''}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ))}
    </div>
  );
}

function ExternalCard({ external }) {
  if (!external || !external.uri) return null;
  let domain = '';
  try { domain = new URL(external.uri).hostname.replace(/^www\./, ''); } catch { /* leave blank */ }
  return (
    <a class="bsky-external bsky-child-link" href={external.uri} target="_blank" rel="noopener noreferrer">
      {external.thumb && (
        <img
          class="bsky-external-thumb"
          src={external.thumb}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <span class="bsky-external-body">
        {external.title && <span class="bsky-external-title">{external.title}</span>}
        {external.description && <span class="bsky-external-desc">{external.description}</span>}
        {domain && <span class="bsky-external-domain">{domain}</span>}
      </span>
    </a>
  );
}

// A quoted post, rendered as a flatter inset block (not a nested card). One level
// deep only: the quoted post's own quotes/link-cards are not rendered.
function QuoteBlock({ record }) {
  if (!record) return null;
  const type = record.$type;
  if (type === 'app.bsky.embed.record#viewBlocked') {
    return <div class="bsky-quote bsky-quote-empty">Quoted post is blocked</div>;
  }
  if (type === 'app.bsky.embed.record#viewNotFound' || type === 'app.bsky.embed.record#viewDetached') {
    return <div class="bsky-quote bsky-quote-empty">Quoted post unavailable</div>;
  }
  if (type !== 'app.bsky.embed.record#viewRecord') {
    return null; // feed generator / list / labeler / starter-pack embed: out of scope this pass
  }

  const author = record.author || {};
  const value = record.value || {};
  const qRkey = record.uri ? record.uri.split('/').pop() : null;
  const href = author.handle && qRkey ? `https://bsky.app/profile/${author.handle}/post/${qRkey}` : null;
  const images = quoteImages(record.embeds);

  const inner = (
    <>
      <div class="bsky-quote-header">
        {author.avatar
          ? <img class="bsky-quote-avatar" src={author.avatar} alt="" />
          : <div class="bsky-quote-avatar bsky-avatar-placeholder" />}
        <span class="bsky-quote-name">{author.displayName || author.handle}</span>
        <span class="bsky-quote-handle">@{author.handle}</span>
      </div>
      {value.text && (
        <p class="bsky-quote-text"><RichText text={value.text} facets={value.facets} plain /></p>
      )}
      <PostImages images={images} small />
    </>
  );

  return href
    ? <a class="bsky-quote bsky-child-link" href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
    : <div class="bsky-quote">{inner}</div>;
}

function quoteImages(embeds) {
  if (!Array.isArray(embeds)) return null;
  for (const e of embeds) {
    if (e && e.$type === 'app.bsky.embed.images#view') return e.images;
    if (e && e.$type === 'app.bsky.embed.recordWithMedia#view' && e.media?.$type === 'app.bsky.embed.images#view') {
      return e.media.images;
    }
  }
  return null;
}

function MediaHint({ label }) {
  return (
    <div class="bsky-media-hint">
      <span class="bsky-media-hint-icon" aria-hidden="true">▶</span>
      {label}
    </div>
  );
}

function getRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return `${Math.floor(diff / 60000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
