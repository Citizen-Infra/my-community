// ATproto auth — placeholder for Task 6
import { signal, computed } from '@preact/signals';

export const blueskyUser = signal(null);
export const authLoading = signal(false);
export const isConnected = computed(() => blueskyUser.value !== null);

export async function initAuth() {
  // Will be implemented in Task 6
}
