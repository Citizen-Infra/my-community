// External hosts, declared once (#85).
//
// Before this module the community-admin host was retyped in four `src/`
// modules plus twice in `public/background.js` plus `public/manifest.json`, and
// nothing kept them in agreement. That is not untidiness: a partial update
// leaves the extension half-migrated and silently broken, which is exactly what
// #84 was. `scripts/check-hosts.mjs` fails the build when the surfaces that
// cannot import this file drift from it.
//
// CA_URL is not just where we send requests: it IS this client's OAuth
// identity. ATProto requires the client-metadata document to declare a
// client_id equal to the URL it was served from, and community-admin generates
// that document from its own API_URL (`server/src/mc-oauth.js`). So this
// constant must track CA's domain exactly — when they diverge, every
// authorization server rejects PAR with invalid_client_metadata before sign-in
// can start.
export const CA_URL = import.meta.env.VITE_CA_URL || 'https://admin.citizeninfra.org';

export const CA_HOST = new URL(CA_URL).hostname;

// The audience for the `getServiceAuth` proof exchanged at /auth/atproto/assert.
//
// Kept as its own constant rather than derived from CA_HOST, because the two
// are not the same fact: community-admin answers on several hosts but declares
// one primary DID, so a host that is not the DID's own host still expects
// tokens minted for the primary. check-hosts.mjs asserts they correspond today
// and fails loudly if they ever stop, rather than silently minting for a DID
// the server will reject.
//
// The server accepts a list of audiences (community-admin#99), so a build
// carrying an older value keeps working until CA clears its grace list. There
// is no lockstep requirement between this file and CA's CA_DID.
export const CA_DID = import.meta.env.VITE_CA_DID || 'did:web:admin.citizeninfra.org';

// Avails, the ecosystem's scheduling tool.
//
// On citizeninfra.org since #90: the old `avails.zhgnv.com` is a personal
// domain, and a store build lists every host it requests where each installer
// reads it (cibc-brain#30). Both hosts serve the same service, verified
// returning identical payloads for a real query before the switch.
//
// This grant genuinely is required, unlike the PDS wildcard #90 removed: avails
// answers an extension-origin request with `access-control-allow-origin:
// https://avails.zhgnv.com` rather than `*`, so CORS alone would block it.
export const AVAILS_URL = import.meta.env.VITE_AVAILS_URL || 'https://avails.citizeninfra.org';
