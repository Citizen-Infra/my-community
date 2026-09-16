import { configurePlatform } from '../lib/platform';
import { CA_URL } from '../lib/config';
import { oauthState } from '../lib/oauth-state';

const STASH_KEY = 'mc_ca_auth_redirect';

configurePlatform({
  kind: 'extension',
  oauthClientId: `${CA_URL}/oauth/client-metadata.json`,
  oauthRedirectUri: `${CA_URL}/oauth/callback`,
  createOAuthState: () => oauthState(
    chrome.runtime?.id,
    btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, ''),
  ),
  launchOAuth: (url) => chrome.identity.launchWebAuthFlow({ url, interactive: true }),
  consumeCommunitySession: async () => {
    const stash = await chrome.storage?.local?.get(STASH_KEY);
    const session = stash?.[STASH_KEY] || null;
    if (session) await chrome.storage.local.remove(STASH_KEY);
    return session;
  },
  mirrorCommunitySession: (session) => {
    if (session) chrome.storage?.local?.set({ mc_ca_session_bg: session });
    else chrome.storage?.local?.remove('mc_ca_session_bg');
  },
});
