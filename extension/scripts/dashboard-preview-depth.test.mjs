import assert from 'node:assert/strict';
import {
  AUTO_PREVIEW_DEPTH,
  MAX_PREVIEW_DEPTH,
  fitPreviewDepth,
  normalizePreviewDepth,
  previewRowDensity,
} from '../src/lib/dashboard-preview-depth.js';

assert.equal(normalizePreviewDepth(undefined), AUTO_PREVIEW_DEPTH);
assert.equal(normalizePreviewDepth('auto'), AUTO_PREVIEW_DEPTH);
assert.equal(normalizePreviewDepth('6'), 6);
assert.equal(normalizePreviewDepth(0), 1);
assert.equal(normalizePreviewDepth(999), MAX_PREVIEW_DEPTH);

assert.equal(fitPreviewDepth(0, 10), 1);
assert.equal(fitPreviewDepth(147, 10), 3);
assert.equal(fitPreviewDepth(1000, 4), 4);
assert.equal(fitPreviewDepth(1000, 0), 0);

assert.equal(previewRowDensity(0, 0), 'compact');
assert.equal(previewRowDensity(180, 2), 'compact');
assert.equal(previewRowDensity(192, 2), 'comfortable');
assert.equal(previewRowDensity(320, 2), 'expansive');

console.log('dashboard preview depth tests passed');
