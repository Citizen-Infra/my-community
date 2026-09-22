function errorForStatus(status) {
  if (status === 401) return 'Your sign-in has expired. Sign in again, then retry.';
  if (status === 409) return 'These accounts have different saved layouts. Resolve that conflict before linking Telegram.';
  if (status === 503) return 'Telegram sign-in is not available yet.';
  if (status === 400 || status === 404) return 'This Telegram sign-in expired. Start again.';
  return 'Telegram sign-in could not be started. Try again.';
}

async function post(path, body, { baseUrl, fetchImpl = fetch, headers = {} } = {}) {
  if (!baseUrl) throw new Error('Telegram authentication requires a Community Admin URL.');
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(errorForStatus(response.status));
  return response.json();
}

export function requestTelegramAuth({ community, intent, state }, options) {
  return post('/auth/telegram/pending', { community, intent, state }, options);
}

export function pollTelegramAuth({ nonce, state }, options) {
  return post('/auth/telegram/poll', { nonce, state }, options);
}
