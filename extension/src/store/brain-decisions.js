import { computed, signal } from '@preact/signals';

import { fetchDecisionIndex } from '../lib/brain-decisions-client.js';
import { deploymentBrainDecisionsEnabled, deploymentConfig } from '../lib/deployment-config.js';
import { caSubject, getToken } from './caAuth.js';

export const brainDecisions = signal([]);
export const brainDecisionsLoading = signal(false);
export const brainDecisionsError = signal(false);
export const openBrainDecisionCount = computed(() => (
  brainDecisions.value.filter((decision) => decision.status === 'needs-response').length
));

let loadGeneration = 0;

export function clearBrainDecisions() {
  loadGeneration += 1;
  brainDecisions.value = [];
  brainDecisionsLoading.value = false;
  brainDecisionsError.value = false;
}

export function retryBrainDecisions() {
  return loadBrainDecisions();
}

export async function loadBrainDecisions() {
  const generation = ++loadGeneration;
  brainDecisionsError.value = false;
  if (!deploymentBrainDecisionsEnabled() || !caSubject.value) {
    brainDecisions.value = [];
    brainDecisionsLoading.value = false;
    return;
  }

  brainDecisionsLoading.value = true;
  try {
    const decisions = await fetchDecisionIndex({
      apiBase: deploymentConfig.decisionApiBase,
      getTokenImpl: getToken,
    });
    if (generation !== loadGeneration) return;
    brainDecisions.value = decisions;
  } catch {
    if (generation !== loadGeneration) return;
    brainDecisions.value = [];
    brainDecisionsError.value = true;
  } finally {
    if (generation === loadGeneration) brainDecisionsLoading.value = false;
  }
}
