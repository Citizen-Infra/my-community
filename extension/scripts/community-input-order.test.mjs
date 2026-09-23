import assert from 'node:assert/strict';
import { communityInputStatus, mergeCommunityInputRows } from '../src/lib/community-input-order.js';

const now = Date.parse('2026-09-08T12:00:00Z');
const rows = mergeCommunityInputRows(
  [{ id: 'resolved-decision', closes_at: '2026-09-01T12:00:00Z', my_vote: 'agree' }],
  [{ id: 'unvoted-source', status: 'candidate', my_vote: null }],
  [
    { path: '2026-09-11-resolved.md', date: '2026-09-11', status: 'resolved', title: 'Resolved record' },
    { path: '2026-09-12-response.md', date: '2026-09-12', status: 'needs-response', title: 'Response needed' },
  ],
  now
);

assert.equal(rows[0].kind, 'brain-decision');
assert.equal(rows[0].d.title, 'Response needed');
assert.equal(rows[1].kind, 'knowledge');
assert.equal(rows[1].k.id, 'unvoted-source');
assert.equal(rows[2].kind, 'decision');
assert.equal(rows[3].kind, 'brain-decision');
assert.equal(communityInputStatus(rows[0].tier), 'Needs your response');
assert.equal(communityInputStatus(1), 'In progress');
assert.equal(communityInputStatus(rows[3].tier), 'Resolved');

console.log('community input order tests passed');
