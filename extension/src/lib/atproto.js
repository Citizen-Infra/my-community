const SESSION_KEY = 'mc_bluesky_session';

export async function createSession(identifier, appPassword) {
  const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: appPassword }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Invalid handle or app password');
    if (res.status === 429) throw new Error('Too many attempts. Please try again later.');
    throw new Error(err.message || 'Authentication failed');
  }

  const data = await res.json();
  const session = {
    did: data.did,
    handle: data.handle,
    accessJwt: data.accessJwt,
    refreshJwt: data.refreshJwt,
    pdsUrl: 'https://bsky.social', // Default PDS
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSavedSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export async function refreshSession(session) {
  const res = await fetch(`${session.pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.refreshJwt}` },
  });

  if (!res.ok) {
    // Refresh failed -- session expired, user needs to re-authenticate
    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  const data = await res.json();
  const updated = {
    ...session,
    accessJwt: data.accessJwt,
    refreshJwt: data.refreshJwt,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return updated;
}

export async function getValidSession() {
  const session = getSavedSession();
  if (!session) return null;

  // Try a simple authenticated request to check if token is still valid
  const res = await fetch(`${session.pdsUrl}/xrpc/app.bsky.actor.getProfile?actor=${session.did}`, {
    headers: { Authorization: `Bearer ${session.accessJwt}` },
  });

  if (res.ok) return session;

  // Token expired -- try refresh
  if (res.status === 400 || res.status === 401) {
    return refreshSession(session);
  }

  return null;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// Authenticated fetch helper
export async function bskyFetch(url, session) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.accessJwt}` },
  });

  if (res.status === 401) {
    // Try refresh and retry
    const refreshed = await refreshSession(session);
    if (!refreshed) return null;
    return fetch(url, {
      headers: { Authorization: `Bearer ${refreshed.accessJwt}` },
    });
  }

  return res;
}

// Authenticated POST helper (for createRecord / deleteRecord)
export async function bskyPost(url, body, session) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const refreshed = await refreshSession(session);
    if (!refreshed) return null;
    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshed.accessJwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  return res;
}
