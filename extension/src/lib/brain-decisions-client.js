import { decisionRoutePath, validateDecisionPath } from './decision-path.js';

const MAX_DECISIONS = 500;
const STATUSES = new Set(['needs-response', 'in-progress', 'resolved']);

export class DecisionIndexRequestError extends Error {
  constructor(status = 503) {
    super('Decision index request failed');
    this.name = 'DecisionIndexRequestError';
    this.status = status;
  }
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseDecision(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'date,path,status,title') {
    throw new DecisionIndexRequestError();
  }
  const path = validateDecisionPath(value.path);
  if (!validDate(value.date) || !STATUSES.has(value.status)
    || typeof value.title !== 'string' || value.title.trim() !== value.title
    || value.title.length === 0 || value.title.length > 500) {
    throw new DecisionIndexRequestError();
  }
  return { ...value, path, href: decisionRoutePath(path) };
}

export async function fetchDecisionIndex({ apiBase, fetchImpl = fetch, getTokenImpl } = {}) {
  if (!apiBase) throw new DecisionIndexRequestError();
  const token = await getTokenImpl?.();
  if (!token) throw new DecisionIndexRequestError(401);

  let response;
  try {
    response = await fetchImpl(new URL('/api/decisions', apiBase), {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new DecisionIndexRequestError();
  }
  if (!response.ok) throw new DecisionIndexRequestError(response.status);
  const cacheControl = response.headers.get('Cache-Control') || '';
  if (!cacheControl.toLowerCase().includes('no-store')) throw new DecisionIndexRequestError();

  let body;
  try { body = await response.json(); } catch { throw new DecisionIndexRequestError(); }
  if (!body || Object.keys(body).sort().join(',') !== 'count,decisions'
    || !Number.isSafeInteger(body.count) || body.count < 0
    || !Array.isArray(body.decisions) || body.count !== body.decisions.length
    || body.decisions.length > MAX_DECISIONS) {
    throw new DecisionIndexRequestError();
  }
  const decisions = body.decisions.map(parseDecision);
  if (new Set(decisions.map((decision) => decision.path)).size !== decisions.length) {
    throw new DecisionIndexRequestError();
  }
  return decisions;
}
