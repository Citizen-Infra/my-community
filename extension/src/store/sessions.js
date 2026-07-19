import { signal, computed } from '@preact/signals';
import { supabase } from '../lib/supabase';
import { authHeader } from './caAuth';
import { getCached, setCached, communityKey } from '../lib/cache';

const EVENTS_API = 'https://scenius-digest.vercel.app/api/events';
const CACHE_KEY = 'mc_sessions_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5min

export const sessions = signal([]);
export const sessionsLoading = signal(false);
// Set when the fetches genuinely failed and left nothing to show, so an outage
// reads as an outage rather than "no sessions".
export const sessionsError = signal(false);

let lastSessionsArgs = [];
export function retrySessions() { return loadSessions(lastSessionsArgs); }

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

// A real event never has a bare URL as its title. These are link posts dropped
// into the Telegram events topic (YouTube videos, homepages, surveys), not events.
// Stopgap on the consumer side until the source filters them: scenius-digest#12.
function isBareUrl(title) {
  return /^https?:\/\/\S+$/i.test((title || '').trim());
}

export async function loadSessions(communities) {
  lastSessionsArgs = communities;
  sessionsError.value = false;
  const selector = communityKey(communities.map((c) => c.id));
  const cached = getCached(CACHE_KEY, CACHE_TTL, selector);
  if (cached) { sessions.value = cached; return; }

  sessionsLoading.value = true;

  // Tracks whether any source genuinely failed (network / 5xx / Supabase error),
  // as opposed to just returning no rows. Drives the error state below.
  let anyFailure = false;

  try {
    const results = [];

    // Fetch events from scenius-digest /api/events for each selected community
    const communityKeys = communities.map((c) => c.id);
    const headers = await authHeader();
    const eventPromises = communityKeys.map((key) =>
      fetch(`${EVENTS_API}?community=${key}`, { headers })
        .then((r) => r.ok ? r.json() : (anyFailure = true, { events: [] }))
        .catch(() => (anyFailure = true, { events: [] }))
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
    const { data, error } = await supabase
      .from('sessions_with_topics')
      .select('*')
      .order('starts_at', { ascending: true });
    if (error) anyFailure = true;
    if (data) {
      results.push(...data.map((s) => ({ ...s, source: 'session' })));
    }

    // Deduplicate by URL (events API may overlap with sessions)
    const seen = new Set();
    const deduped = [];
    for (const item of results) {
      // Only show events we can place in time; also skip bare-link junk.
      // An undated item defaults to 'upcoming' and sticks there forever (past
      // events shown as Coming Up). Real fix is date parsing at the source:
      // scenius-digest#12.
      if (!item.starts_at || isBareUrl(item.title)) continue;
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
    // Don't cache a partial/failed result as authoritative; let the next open retry.
    if (!anyFailure) setCached(CACHE_KEY, deduped, selector);
    // Only an outage that also left nothing to show is an error; partial results render.
    sessionsError.value = anyFailure && deduped.length === 0;
  } catch (err) {
    console.error('Failed to load sessions:', err);
    sessionsError.value = true;
  }

  sessionsLoading.value = false;
}
