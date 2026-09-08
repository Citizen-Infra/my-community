import assert from 'node:assert/strict';
import {
  communityScope,
  networkPostMeta,
  networkScope,
} from '../src/lib/dashboard-preview-meta.js';

const feeds = [
  { uri: 'timeline', name: 'Following', type: 'timeline' },
  { uri: 'at://feed/popular', name: 'Popular', type: 'feed' },
];

assert.equal(
  communityScope(['cibc', 'scenius'], [{ id: 'cibc', name: 'Citizen Infra Builders' }, { id: 'scenius', name: 'Scenius' }]),
  'Citizen Infra Builders · Scenius'
);
assert.equal(communityScope(['unknown'], []), 'unknown');

assert.equal(networkScope({
  feedUri: 'timeline',
  availableFeeds: feeds,
  timeWindow: '7d',
  showReposts: false,
  weightedSort: true,
}), 'Following · 7d · Most discussed · Reposts off');

assert.equal(networkScope({
  feedUri: 'at://feed/popular',
  availableFeeds: feeds,
  timeWindow: '24h',
  showReposts: true,
  weightedSort: false,
}), 'Popular · Reposts on');

assert.equal(networkPostMeta({
  author: { handle: 'member.example' },
  replyCount: 1,
  repostCount: 12,
}), '@member.example · 1 reply · 12 reposts');

console.log('dashboard preview meta tests passed');
