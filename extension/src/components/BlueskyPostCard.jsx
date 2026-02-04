export function BlueskyPostCard({ post }) {
  // Build link to bsky.app
  const rkey = post.uri.split('/').pop();
  const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;

  // Relative time
  const timeAgo = getRelativeTime(post.createdAt);

  const repostedBy = post.reason?.by?.displayName || post.reason?.by?.handle;

  return (
    <a class="bsky-card" href={postUrl} target="_blank" rel="noopener noreferrer">
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
          <span class="bsky-display-name">{post.author.displayName}</span>
          <span class="bsky-handle">@{post.author.handle}</span>
        </div>
        <span class="bsky-time">{timeAgo}</span>
      </div>

      {post.text && <p class="bsky-text">{post.text}</p>}

      {post.embed?.images && (
        <div class="bsky-images">
          {post.embed.images.slice(0, 2).map((img, i) => (
            <img key={i} class="bsky-image" src={img.thumb || img.fullsize} alt={img.alt || ''} />
          ))}
        </div>
      )}

      <div class="bsky-stats">
        <span class="bsky-stat">{post.replyCount} replies</span>
        <span class="bsky-stat">{post.repostCount} reposts</span>
        <span class="bsky-stat">{post.likeCount} likes</span>
      </div>
    </a>
  );
}

function getRelativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return `${Math.floor(diff / 60000)}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
