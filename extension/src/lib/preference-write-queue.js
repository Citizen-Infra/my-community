import { preferencesMatch } from './dashboard-preferences.js';

export function latestUnsavedPreference(pending, saved) {
  return pending && !preferencesMatch(pending, saved) ? pending : null;
}
