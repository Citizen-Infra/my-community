import { signal, computed } from '@preact/signals';
import { supabase } from '../lib/supabase';

export const sessions = signal([]);
export const sessionsLoading = signal(false);

export const activeSessions = computed(() =>
  sessions.value.filter((s) => s.status === 'active')
);
export const upcomingSessions = computed(() =>
  sessions.value.filter((s) => s.status === 'upcoming')
);
export const completedSessions = computed(() =>
  sessions.value.filter((s) => s.status === 'completed')
);

export async function loadSessions() {
  sessionsLoading.value = true;
  const { data, error } = await supabase
    .from('sessions_with_topics')
    .select('*')
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('Failed to load sessions:', error);
    sessionsLoading.value = false;
    return;
  }
  sessions.value = data || [];
  sessionsLoading.value = false;
}
