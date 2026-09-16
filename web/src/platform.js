import { configurePlatform } from '../../extension/src/lib/platform';
import { clearCommunityBlueskySignIn, markCommunityBlueskySignIn } from './bluesky-signin-intent';

const WEB_ORIGIN = import.meta.env.VITE_WEB_ORIGIN || 'https://my.citizeninfra.org';

function randomState() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

configurePlatform({
  kind: 'web',
  oauthClientId: `${WEB_ORIGIN}/oauth/client-metadata.json`,
  oauthRedirectUri: `${WEB_ORIGIN}/auth/atproto/callback`,
  createOAuthState: randomState,
  launchOAuth: async (url) => {
    location.assign(url);
    return null;
  },
  prepareCommunityBlueskySignIn: markCommunityBlueskySignIn,
  clearCommunityBlueskySignIn,
});
