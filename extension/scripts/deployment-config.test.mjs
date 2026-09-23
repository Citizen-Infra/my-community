import assert from 'node:assert/strict';
import {
  createDeploymentConfig,
  deploymentFeedVisible,
} from '../src/lib/deployment-config.js';

const defaults = createDeploymentConfig();
assert.equal(defaults.brand.name, 'My Community', 'ordinary builds keep the default brand');
for (const feed of ['network', 'digest', 'participation', 'communityInput']) {
  assert.equal(deploymentFeedVisible(feed, false, defaults), false, `${feed} can be hidden`);
}

const withoutNetwork = createDeploymentConfig({ VITE_BLUESKY_ENABLED: 'false' });
assert.equal(deploymentFeedVisible('network', true, withoutNetwork), false, 'a deployment can force Network off');
assert.equal(deploymentFeedVisible('digest', true, withoutNetwork), true, 'disabling Network does not hide other feeds');

const pxxi = createDeploymentConfig({ VITE_PINNED_COMMUNITY_ID: 'philanthropic-xxi' });
assert.equal(pxxi.brand.name, 'Philanthropic XXI', 'the pinned PXXI build uses its fixed brand');

console.log('deployment config tests passed');
