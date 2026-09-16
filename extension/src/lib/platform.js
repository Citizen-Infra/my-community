const fallback = {
  kind: 'browser',
  oauthClientId: '',
  oauthRedirectUri: '',
  createOAuthState: () => crypto.randomUUID(),
  launchOAuth: async (url) => {
    globalThis.location.assign(url);
    return null;
  },
  consumeCommunitySession: async () => null,
  mirrorCommunitySession: () => {},
  prepareCommunityBlueskySignIn: () => {},
};

let adapter = fallback;

// The dashboard/store graph imports only this platform-neutral registry. The
// extension and web entry points install their adapter before rendering.
export function configurePlatform(next) {
  adapter = { ...fallback, ...next };
}

export function platform() {
  return adapter;
}
