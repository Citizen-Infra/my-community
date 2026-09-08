import assert from 'node:assert/strict';
import { mergeCommunityInputRows } from '../src/lib/community-input-order.js';

const now = Date.parse('2026-09-08T12:00:00Z');
const rows = mergeCommunityInputRows(
  [{ id: 'resolved-decision', closes_at: '2026-09-01T12:00:00Z', my_vote: 'agree' }],
  [{ id: 'unvoted-source', status: 'candidate', my_vote: null }],
  now
);

assert.equal(rows[0].kind, 'knowledge');
assert.equal(rows[0].k.id, 'unvoted-source');
assert.equal(rows[1].kind, 'decision');

console.log('community input order tests passed');
