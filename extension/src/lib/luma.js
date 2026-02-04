const CACHE_KEY = 'mc_luma_cache';
const CACHE_TTL = 60 * 60 * 1000;

export async function fetchLumaEvents(lumaUrl) {
  if (!lumaUrl) return [];

  try {
    const slug = lumaUrl.replace(/\/$/, '').split('/').pop();
    const res = await fetch(`https://api.lu.ma/calendar/get-items?calendar_api_id=${slug}&period=future`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.entries || []).map((entry) => ({
      id: `luma-${entry.event?.api_id || entry.api_id}`,
      title: entry.event?.name || 'Untitled',
      description: entry.event?.description_short || '',
      url: `https://lu.ma/${entry.event?.url || slug}`,
      starts_at: entry.event?.start_at || null,
      ends_at: entry.event?.end_at || null,
      source: 'luma',
      status: getEventStatus(entry.event?.start_at, entry.event?.end_at),
    }));
  } catch (err) {
    console.error('Failed to fetch Luma events:', err);
    return [];
  }
}

function getEventStatus(startAt, endAt) {
  if (!startAt) return 'upcoming';
  const now = new Date();
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'completed';
}
