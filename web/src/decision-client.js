import { validateDecisionPath } from './decision-path.js';

const MAX_DECISION_BYTES = 200_000;

export class DecisionRequestError extends Error {
  constructor(status) {
    super('Decision request failed');
    this.name = 'DecisionRequestError';
    this.status = status;
  }
}

export async function fetchDecision(path, {
  apiBase,
  fetchImpl = fetch,
  getTokenImpl,
  signal,
} = {}) {
  const requestedPath = validateDecisionPath(path);
  if (!apiBase) throw new DecisionRequestError(503);
  const token = await getTokenImpl?.();
  if (!token) throw new DecisionRequestError(401);

  const url = new URL('/api/decisions', apiBase);
  url.searchParams.set('path', requestedPath);
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new DecisionRequestError(503);
  }
  if (!response.ok) throw new DecisionRequestError(response.status);
  const cacheControl = response.headers.get('Cache-Control') || '';
  if (!cacheControl.toLowerCase().includes('no-store')) throw new DecisionRequestError(503);

  let body;
  try { body = await response.json(); } catch { throw new DecisionRequestError(503); }
  if (!body || Object.keys(body).sort().join(',') !== 'markdown,path'
    || body.path !== requestedPath || typeof body.markdown !== 'string'
    || new TextEncoder().encode(body.markdown).byteLength > MAX_DECISION_BYTES) {
    throw new DecisionRequestError(503);
  }
  return body;
}
