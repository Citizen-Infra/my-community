import { useState } from 'preact/hooks';
import { requestSignIn, requestBlueskySignIn } from '../store/caAuth';
import { isConnected, blueskyUser, connectBluesky } from '../store/auth';
import { loadCommunities, selectedCommunityIds } from '../store/communities';
import { loadProposals } from '../store/proposals';
import '../styles/auth-modal.css';

// Signed-out state for the Community Input feed: consent needs a verified member, so
// the feed itself owns a connect prompt (the same two-door affordance as Settings —
// email magic link or Bluesky). Kept self-contained so the live Settings sign-in is
// untouched, matching how the Network feed owns its own connect state.
export function CommunityInputConnect() {
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [bskyBusy, setBskyBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState(null);

  async function submitEmail(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setEmailBusy(true);
    try {
      await requestSignIn(email.trim());
      setLinkSent(true);
      setEmail('');
    } catch (err) {
      setError(err.message);
    }
    setEmailBusy(false);
  }

  async function submitBluesky(e) {
    e.preventDefault();
    setError(null);
    setBskyBusy(true);
    try {
      if (!isConnected.value) {
        const h = handle.trim();
        if (!h) { setError('Enter your Bluesky handle.'); setBskyBusy(false); return; }
        await connectBluesky(h);
      }
      await requestBlueskySignIn();
      setHandle('');
      await loadCommunities();
      if (selectedCommunityIds.value.length > 0) loadProposals(selectedCommunityIds.value);
    } catch (err) {
      setError(err.message);
    }
    setBskyBusy(false);
  }

  return (
    <div class="ci-connect">
      <h2 class="ci-connect-title">Add your voice</h2>
      <p class="ci-connect-desc">
        Consent decisions need a verified member. Sign in to see what your communities are
        weighing and to agree or raise an objection.
      </p>

      {linkSent ? (
        <p class="ci-connect-sent">Check your email for a sign-in link.</p>
      ) : (
        <>
          <form onSubmit={submitEmail} class="auth-form-compact">
            <input
              type="email"
              class="auth-input"
              placeholder="you@example.com"
              value={email}
              onInput={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" class="auth-submit" disabled={emailBusy}>
              {emailBusy ? 'Sending…' : 'Send magic link'}
            </button>
          </form>

          <div class="auth-or">or</div>

          <form onSubmit={submitBluesky} class="auth-form-compact">
            {!isConnected.value && (
              <input
                type="text"
                class="auth-input"
                placeholder="Handle (e.g. alice.bsky.social)"
                value={handle}
                onInput={(e) => setHandle(e.target.value)}
              />
            )}
            <button type="submit" class="auth-submit" disabled={bskyBusy}>
              {bskyBusy
                ? 'Signing in…'
                : isConnected.value
                  ? `Sign in as @${blueskyUser.value.handle}`
                  : 'Sign in with Bluesky'}
            </button>
          </form>

          {error && <p class="auth-error">{error}</p>}
        </>
      )}
    </div>
  );
}
