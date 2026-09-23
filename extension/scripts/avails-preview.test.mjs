import assert from 'node:assert/strict';
import {
  availsParticipationPreview,
  visibleAvailsCommunityIds,
} from '../src/lib/avails-preview.js';

assert.deepEqual(
  visibleAvailsCommunityIds([{ id: 'cibc' }, { id: 'philanthropic-xxi' }, null, { id: '' }]),
  ['cibc', 'philanthropic-xxi'],
  'Avails reads use only communities returned by visible community discovery',
);
assert.deepEqual(visibleAvailsCommunityIds(null), [], 'missing community discovery fails closed');

const preview = availsParticipationPreview({
  community: 'philanthropic-xxi',
  description: 'Choose every time that works.',
  did: 'did:plc:member',
  responseCount: 3,
  rkey: 'poll-1',
  title: 'Plan the next gathering',
}, {
  availsUrl: 'https://avails.citizeninfra.org/',
  communityName: 'Philanthropic XXI',
});

assert.equal(preview.id, 'did:plc:member/poll-1');
assert.equal(preview.source, 'avails');
assert.equal(preview.community_id, 'philanthropic-xxi');
assert.equal(preview.previewStatus, 'Finding a time');
assert.equal(preview.previewProvenance, 'Philanthropic XXI · 3 responses');
assert.equal(preview.previewHref, 'https://avails.citizeninfra.org/p/did:plc:member/poll-1');
assert.equal(preview.description, 'Choose every time that works.');

assert.equal(
  availsParticipationPreview({ community: 'cibc', did: 'did:plc:x', rkey: 'one', responseCount: 1 }).previewProvenance,
  'cibc · 1 response',
);
assert.equal(
  availsParticipationPreview({ community: 'cibc', did: 'did:plc:x', rkey: 'none' }).previewProvenance,
  'cibc · No responses yet',
);

console.log('Avails participation preview tests passed');
