import assert from 'node:assert/strict';
import {
  DEFAULT_DASHBOARD_ORDER,
  moveDashboardTab,
  normalizeDashboardOrder,
  reorderDashboardTab,
} from '../src/lib/dashboard-order.js';

assert.deepEqual(normalizeDashboardOrder(null), DEFAULT_DASHBOARD_ORDER);
assert.deepEqual(
  normalizeDashboardOrder(['digest', 'network']),
  ['digest', 'network', 'participation', 'communityInput']
);
assert.deepEqual(
  normalizeDashboardOrder(['digest', 'unknown', 'digest']),
  ['digest', 'network', 'participation', 'communityInput']
);
assert.deepEqual(
  reorderDashboardTab(DEFAULT_DASHBOARD_ORDER, 'communityInput', 'digest'),
  ['network', 'communityInput', 'digest', 'participation']
);
assert.deepEqual(
  moveDashboardTab(DEFAULT_DASHBOARD_ORDER, 'digest', 1),
  ['network', 'participation', 'digest', 'communityInput']
);
assert.deepEqual(
  moveDashboardTab(DEFAULT_DASHBOARD_ORDER, 'network', -1),
  DEFAULT_DASHBOARD_ORDER
);
assert.deepEqual(
  moveDashboardTab(DEFAULT_DASHBOARD_ORDER, 'network', 1, ['network', 'participation', 'communityInput']),
  ['participation', 'digest', 'network', 'communityInput']
);
assert.deepEqual(
  reorderDashboardTab(DEFAULT_DASHBOARD_ORDER, 'communityInput', 'network', ['network', 'participation', 'communityInput']),
  ['communityInput', 'digest', 'network', 'participation']
);

console.log('dashboard order tests passed');
