import { signal, computed } from '@preact/signals';
import { supabase } from '../lib/supabase';
import { fetchLumaEvents } from '../lib/luma';

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

export async function loadSessions(communities) {
  sessionsLoading.value = true;

  try {
    const results = [];

    // Fetch Supabase sessions (all for now)
    const { data } = await supabase
      .from('sessions_with_topics')
      .select('*')
      .order('starts_at', { ascending: true });
    if (data) {
      results.push(...data.map((s) => ({ ...s, source: 'session' })));
    }

    // Fetch Luma events for communities that have luma_url
    const lumaPromises = communities
      .filter((c) => c.luma_url)
      .map((c) => fetchLumaEvents(c.luma_url));
    const lumaResults = await Promise.all(lumaPromises);
    lumaResults.forEach((events) => results.push(...events));

    // Sort by starts_at
    results.sort((a, b) => new Date(a.starts_at || 0) - new Date(b.starts_at || 0));

    sessions.value = results;
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }

  sessionsLoading.value = false;
}
