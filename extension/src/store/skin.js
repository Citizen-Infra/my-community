import { signal, computed, effect } from '@preact/signals';
import { CA_URL } from '../lib/config';
import { deploymentConfig } from '../lib/deployment-config';
import { applySkinToDocument, createSkinController } from '../lib/skin-runtime';
import { caSessionHeader, caSubject } from './caAuth';

// Community skins (#18). The decisions live in lib/skin-runtime.js; this file
// binds them to signals, the page and the community-admin session.

export const skinState = signal({
  selection: null,
  applied: null,
  options: [],
  update: null,
  notice: null,
  status: 'idle',
});

export const skinsEnabled = deploymentConfig.skinsEnabled !== false;
// The pin the preference document syncs (#152): { communityId, skinId, revision } | null.
export const skinSelection = computed(() => skinState.value.selection);

const controller = createSkinController({
  caUrl: CA_URL,
  fetch: (...args) => fetch(...args),
  storage: localStorage,
  headers: caSessionHeader,
  signedIn: () => !!caSubject.peek(),
  enabled: skinsEnabled,
  apply: (entry) => applySkinToDocument(document, entry),
  onChange: (next) => { skinState.value = next; },
});

// Runs at import, before the first render, so a selected skin cached on this
// device paints with the page instead of flashing the default first.
controller.hydrate();

let lastIds = [];
export function refreshSkins(communityIds = lastIds) {
  lastIds = [...communityIds];
  return controller.refresh(lastIds);
}

export const previewSkin = (option) => controller.preview(option);
export const selectSkin = (option) => controller.select(option);
export const restoreDefaultSkin = () => controller.restoreDefault();
export const applySyncedSkinSelection = (ref) => {
  if (controller.setSelectionFromSync(ref)) void refreshSkins();
};

// Sign-out (or a session revoked server-side) takes private revisions with it.
let previousSubject = caSubject.peek();
effect(() => {
  const subject = caSubject.value;
  if (previousSubject && !subject) controller.signedOut();
  previousSubject = subject;
});
