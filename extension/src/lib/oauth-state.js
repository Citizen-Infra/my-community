// The OAuth `state` value, carrying this extension's own id (#79).
//
// community-admin's /oauth/callback relay has to bounce the authorization
// response to `https://<our id>.chromiumapp.org/`, and `state` is the only
// value that round-trips through the authorization server back to that relay.
// A Chrome Web Store publish changes our id while sideloaded installs update by
// hand, so both ids are live in the wild at once and the relay cannot assume
// which one to send a given response to.
//
// Format is `<id>.<random>`, matching the `[a-p]{32}\.` prefix the relay looks
// for (community-admin `server/src/mc-oauth.js`, `redirectForState`). The
// random half is what actually binds the response to this request and is
// unchanged; the prefix is routing information only, and the relay checks it
// against an allowlist rather than trusting it.
//
// Deliberately its own module: it has no imports, so it can be exercised by
// `scripts/oauth-state.test.mjs` under plain node. `lib/oauth-atproto.js` pulls
// in `lib/config.js`, whose `import.meta.env` throws outside Vite.
//
// Degrades safely. Without an id — any context where `chrome.runtime.id` is
// missing — this returns the bare random value, which is exactly what every
// build before #79 sent, and the relay falls back to its default entry.
export function oauthState(extensionId, random) {
  return extensionId ? `${extensionId}.${random}` : random;
}
