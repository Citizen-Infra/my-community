// Bluesky reads/writes now go through the in-extension ATProto OAuth session
// (DPoP), which owns the tokens. See lib/oauth-atproto.js.
import { dpopFetch } from './oauth-atproto';

export async function bskyFetch(url) {
  return dpopFetch(url, { method: 'GET' });
}

export async function bskyPost(url, body) {
  return dpopFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
