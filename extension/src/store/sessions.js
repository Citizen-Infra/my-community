import { signal, computed } from '@preact/signals';
import { supabase } from '../lib/supabase';

const EVENTS_API = 'https://scenius-digest.vercel.app/api/events';

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

function getEventStatus(startsAt, endsAt) {
  if (!startsAt) return 'upcoming';
  const now = new Date();
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'completed';
}

export async function loadSessions(communities) {
  sessionsLoading.value = true;

  try {
    const results = [];

    // Fetch events from scenius-digest /api/events for each selected community
    const communityKeys = communities.map((c) => c.id);
    const eventPromises = communityKeys.map((key) =>
      fetch(`${EVENTS_API}?community=${key}`)
        .then((r) => r.ok ? r.json() : { events: [] })
        .catch(() => ({ events: [] }))
    );
    const eventResults = await Promise.all(eventPromises);
    for (const result of eventResults) {
      for (const event of result.events || []) {
        results.push({
          ...event,
          status: getEventStatus(event.starts_at, event.ends_at),
        });
      }
    }

    // Fetch Supabase sessions (Harmonica sessions, kept as fallback)
    const { data } = await supabase
      .from('sessions_with_topics')
      .select('*')
      .order('starts_at', { ascending: true });
    if (data) {
      results.push(...data.map((s) => ({ ...s, source: 'session' })));
    }

    // Deduplicate by URL (events API may overlap with sessions)
    const seen = new Set();
    const deduped = [];
    for (const item of results) {
      const key = item.url || item.id;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }

    // Sort by starts_at ascending, nulls last
    deduped.sort((a, b) => {
      const aTime = a.starts_at ? new Date(a.starts_at).getTime() : Infinity;
      const bTime = b.starts_at ? new Date(b.starts_at).getTime() : Infinity;
      return aTime - bTime;
    });

    sessions.value = deduped;
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }

  sessionsLoading.value = false;
}
