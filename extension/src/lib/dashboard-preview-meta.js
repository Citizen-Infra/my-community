export function communityScope(ids, communities) {
  return ids
    .map((id) => communities.find((community) => community.id === id)?.name || id)
    .filter(Boolean)
    .join(' · ');
}

export function networkScope({
  feedUri,
  availableFeeds,
  timeWindow,
  showReposts,
  weightedSort,
}) {
  const currentFeed = availableFeeds.find((feed) => feed.uri === feedUri);
  const feedLabel = currentFeed?.name || (feedUri === 'timeline' ? 'Following' : 'Selected feed');
  const algorithmic = currentFeed
    ? currentFeed.type === 'feed'
    : (feedUri !== 'timeline' && !feedUri.includes('app.bsky.graph.list'));
  const parts = [feedLabel];
  if (!algorithmic) {
    parts.push(timeWindow, weightedSort ? 'Most discussed' : 'Most liked');
  }
  parts.push(`Reposts ${showReposts ? 'on' : 'off'}`);
  return parts.join(' · ');
}

function countLabel(count, singular) {
  const value = count || 0;
  return `${value} ${value === 1 ? singular : `${singular}s`}`;
}

export function networkPostMeta(post) {
  return [
    `@${post.author.handle}`,
    countLabel(post.replyCount, 'reply'),
    countLabel(post.repostCount, 'repost'),
  ].join(' · ');
}
