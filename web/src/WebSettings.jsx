import { useEffect, useRef, useState } from 'preact/hooks';
import {
  allCommunities,
  communitiesStatus,
  selectedCommunityIds,
  toggleCommunity,
  loadCommunities,
} from '../../extension/src/store/communities';
import {
  caHandle,
  caSignedIn,
  caSubject,
  caTelegramLinked,
  caType,
  requestBlueskySignIn,
  requestSignIn,
  signOut,
} from '../../extension/src/store/caAuth';
import { blueskyUser, connectBluesky, disconnectBluesky, isConnected } from '../../extension/src/store/auth';
import { theme, setTheme } from '../../extension/src/store/theme';
import { SkinChooser } from '../../extension/src/components/SkinChooser';
import { skinsEnabled } from '../../extension/src/store/skin';
import { visibleTabs, setTabVisible } from '../../extension/src/store/panels';
import {
  blueskyShowReposts,
  blueskyTimeWindow,
  blueskyWeightedSort,
  setBlueskyShowReposts,
  setBlueskyTimeWindow,
  setBlueskyWeightedSort,
} from '../../extension/src/store/bluesky';
import { visibleSupportingTileKeys, setSupportingTileVisible } from '../../extension/src/store/supporting';
import { endPreferenceContinuity } from '../../extension/src/store/preferences';
import { deploymentConfig } from '../../extension/src/lib/deployment-config';
import { TelegramSignIn } from './TelegramSignIn';

const FEEDS = [
  ['digest', 'Digest'],
  ['network', 'Network'],
  ['participation', 'Participation'],
  ['communityInput', 'Community Input'],
];
const SUPPORTING = [
  ['featured', 'Featured'],
  ['openCollective', 'Open Collective'],
  ['stewardship', 'Stewardship'],
  ['jam', 'Live listening'],
];

export function WebSettings({ onClose, onCustomize, onInstall, canInstall }) {
  const dialogRef = useRef(null);
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href]')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', onKeyDown);
    return () => removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function emailSignIn(event) {
    event.preventDefault();
    setBusy('email'); setMessage('');
    try {
      await requestSignIn(email.trim());
      setMessage('Check your email. This page can stay open.');
      setEmail('');
    } catch (error) { setMessage(error.message); }
    setBusy(null);
  }

  async function blueskySignIn(event) {
    event.preventDefault();
    setBusy('bluesky'); setMessage('');
    try {
      if (!isConnected.value) {
        const result = await connectBluesky(handle.trim(), { communitySignIn: true });
        if (!result) return;
      }
      await requestBlueskySignIn();
      await loadCommunities();
      setMessage('Signed in with Bluesky.');
    } catch (error) { setMessage(error.message); }
    setBusy(null);
  }

  async function signOutEverywhere() {
    endPreferenceContinuity();
    await signOut();
    await disconnectBluesky();
    location.reload();
  }

  const accountLabel = caType.value === 'atproto'
    ? `@${caHandle.value || blueskyUser.value?.handle || caSubject.value}`
    : caType.value === 'telegram' ? 'Telegram account' : caSubject.value;
  const telegramCommunity = deploymentConfig.pinnedCommunityId;
  const signedOutDoors = 1 + Number(Boolean(telegramCommunity)) + Number(!telegramCommunity && deploymentConfig.blueskyEnabled);
  return (
    <div class="web-settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={dialogRef} tabindex="-1" class="web-settings" role="dialog" aria-modal="true" aria-labelledby="web-settings-title">
        <header class="web-settings-header">
          <div><p>Personal dashboard</p><h2 id="web-settings-title">Settings</h2></div>
          <button type="button" class="web-settings-close" onClick={onClose} aria-label="Close settings">×</button>
        </header>

        <div class="web-settings-content">
          <section class="settings-section">
            <div class="settings-heading"><h3>Account</h3><p>{telegramCommunity
              ? 'Continue with Telegram to confirm your group membership. If you already linked an email account to Telegram, you can use that too.'
              : 'Sign in to unlock private communities and carry your layout across devices.'}</p></div>
            {caSignedIn.value ? (
              <>
                <div class="account-signed-in">
                  <div><span>Signed in as</span><strong>{accountLabel}</strong></div>
                  <button type="button" onClick={signOutEverywhere}>Sign out</button>
                </div>
                {telegramCommunity && !caTelegramLinked.value && (
                  <div class="telegram-link-card">
                    <div><strong>Connect Telegram</strong><p>Confirm your Philanthropic XXI membership and receive member access on this account.</p></div>
                    <TelegramSignIn community={telegramCommunity} intent="link" />
                  </div>
                )}
                {telegramCommunity && caTelegramLinked.value && <p class="telegram-connected">Telegram connected</p>}
              </>
            ) : (
              <div class={`account-doors account-doors-${signedOutDoors}`}>
                {telegramCommunity && <><div class="telegram-door"><span>Telegram</span><TelegramSignIn community={telegramCommunity} /></div><span class="account-or">or</span></>}
                <form onSubmit={emailSignIn}>
                  <label for="web-email">{telegramCommunity ? 'Linked email account' : 'Email'}</label>
                  <div><input id="web-email" type="email" value={email} onInput={(event) => setEmail(event.currentTarget.value)} placeholder="you@example.com" required /><button data-requires-network disabled={busy === 'email'}>{busy === 'email' ? 'Sending…' : 'Send link'}</button></div>
                </form>
                {!telegramCommunity && deploymentConfig.blueskyEnabled && <><span class="account-or">or</span><form onSubmit={blueskySignIn}>
                  <label for="web-handle">Bluesky</label>
                  {!isConnected.value && <input id="web-handle" value={handle} onInput={(event) => setHandle(event.currentTarget.value)} placeholder="name.bsky.social" required />}
                  <button data-requires-network disabled={busy === 'bluesky'}>{busy === 'bluesky' ? 'Opening…' : isConnected.value ? `Continue as @${blueskyUser.value?.handle}` : 'Continue with Bluesky'}</button>
                </form></>}
              </div>
            )}
            {message && <p class="settings-message" role="status">{message}</p>}
          </section>

          {!deploymentConfig.pinnedCommunityId && <section class="settings-section">
            <div class="settings-heading"><h3>Communities</h3><p>Public communities work without an account. Private communities appear after sign-in.</p></div>
            {communitiesStatus.value === 'error' ? <p>Communities could not be refreshed.</p> : (
              <div class="settings-check-grid">
                {allCommunities.value.map((community) => (
                  <label key={community.id} class="settings-check-card">
                    <input type="checkbox" checked={selectedCommunityIds.value.includes(community.id)} onChange={() => toggleCommunity(community.id)} />
                    <span><strong>{community.name}</strong><small>{community.visibility === 'private' ? 'Private member space' : community.city || 'Community feed'}</small></span>
                  </label>
                ))}
              </div>
            )}
          </section>}

          <section class="settings-section">
            <div class="settings-heading"><h3>Dashboard</h3><p>Choose what belongs on your front page, then arrange it in context.</p></div>
            <div class="settings-toggle-list">
              {FEEDS.filter(([key]) => key !== 'network' || deploymentConfig.blueskyEnabled).map(([key, label]) => <Toggle key={key} label={label} checked={visibleTabs.value[key]} onChange={(value) => setTabVisible(key, value)} />)}
            </div>
            <button type="button" class="settings-inline-action" onClick={onCustomize}>Arrange tiles and previews</button>
          </section>

          {deploymentConfig.blueskyEnabled && <section class="settings-section">
            <div class="settings-heading"><h3>Network</h3><p>These choices follow your account; your Bluesky credentials do not.</p></div>
            <div class="settings-field-row">
              <label>Time window<select value={blueskyTimeWindow.value} onChange={(event) => setBlueskyTimeWindow(event.currentTarget.value)}><option value="24h">24 hours</option><option value="7d">7 days</option><option value="30d">30 days</option></select></label>
              <label>Ranking<select value={blueskyWeightedSort.value ? 'most-discussed' : 'most-liked'} onChange={(event) => setBlueskyWeightedSort(event.currentTarget.value === 'most-discussed')}><option value="most-liked">Most liked</option><option value="most-discussed">Most discussed</option></select></label>
            </div>
            <Toggle label="Show reposts" checked={blueskyShowReposts.value} onChange={setBlueskyShowReposts} />
          </section>}

          <section class="settings-section">
            <div class="settings-heading"><h3>Supporting spaces</h3><p>Eligible connected and role-based tiles appear only when they have something useful to show.</p></div>
            <div class="settings-toggle-list">
              {SUPPORTING.map(([key, label]) => <Toggle key={key} label={label} checked={visibleSupportingTileKeys.value.includes(key)} onChange={(value) => setSupportingTileVisible(key, value)} />)}
            </div>
          </section>

          <section class="settings-section settings-compact">
            <div class="settings-heading"><h3>Appearance</h3></div>
            <div class="settings-segmented" aria-label="Theme">{['system', 'light', 'dark'].map((value) => <button type="button" class={theme.value === value ? 'active' : ''} aria-pressed={theme.value === value} onClick={() => setTheme(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
            {canInstall && <button type="button" class="settings-install" onClick={onInstall}>Install this dashboard</button>}
          </section>

          {skinsEnabled && <section class="settings-section">
            <SkinChooser />
          </section>}
        </div>
      </section>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return <label class="settings-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} /><i aria-hidden="true" /></label>;
}
