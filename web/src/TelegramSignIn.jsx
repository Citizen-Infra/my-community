import { useEffect, useState } from 'preact/hooks';
import { platform } from '../../extension/src/lib/platform';
import { CA_URL } from '../../extension/src/lib/config';
import {
  caSessionHeader,
  clearTelegramSignInState,
  exchangeTelegramSignIn,
  rememberTelegramSignInState,
  refreshCommunityAccount,
} from '../../extension/src/store/caAuth';
import { loadCommunities, selectedCommunities } from '../../extension/src/store/communities';
import { clearDigest, loadDigest } from '../../extension/src/store/digest';
import { clearSessions, loadSessions } from '../../extension/src/store/sessions';
import { clearProposals, loadProposals } from '../../extension/src/store/proposals';
import { clearWikiQueue, loadWikiQueue } from '../../extension/src/store/knowledge';
import { clearBrainDecisions, loadBrainDecisions } from '../../extension/src/store/brain-decisions';
import {
  pollTelegramAuth,
  refreshTelegramLinkedData,
  requestTelegramAuth,
} from './telegram-auth';

const POLL_INTERVAL_MS = 2_000;

export function TelegramSignIn({ community, intent = 'signin', onComplete, buttonLabel, linkLabel }) {
  const [flow, setFlow] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!flow || status !== 'waiting') return undefined;
    let cancelled = false;
    let timer;

    async function poll() {
      try {
        const result = await pollTelegramAuth(
          { nonce: flow.nonce, state: flow.state },
          { baseUrl: CA_URL },
        );
        if (cancelled) return;
        if (result.status === 'pending') {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        if (intent === 'signin') {
          await exchangeTelegramSignIn(result.code, flow.state);
          await loadCommunities({ force: true });
        } else {
          await refreshTelegramLinkedData(community, {
            invalidatePrivateData: () => {
              clearDigest();
              clearSessions();
              clearProposals();
              clearWikiQueue();
              clearBrainDecisions();
            },
            refreshAccount: refreshCommunityAccount,
            loadCommunityList: loadCommunities,
            currentCommunities: () => selectedCommunities.value,
            loadDigestFeed: loadDigest,
            loadSessionsFeed: loadSessions,
            loadProposalsFeed: loadProposals,
            loadWikiFeed: loadWikiQueue,
            loadBrainDecisionsFeed: loadBrainDecisions,
          });
          clearTelegramSignInState(flow.state);
        }
        if (cancelled) return;
        setStatus('complete');
        setMessage(intent === 'signin' ? 'Signed in with Telegram.' : 'Telegram is connected to your account.');
        onComplete?.();
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error.message);
        clearTelegramSignInState(flow.state);
      }
    }

    timer = setTimeout(poll, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [flow, status, intent, onComplete]);

  async function start() {
    setStatus('starting');
    setMessage('');
    let state;
    try {
      state = platform().createOAuthState();
      rememberTelegramSignInState(state);
      const pending = await requestTelegramAuth(
        { community, intent, state },
        { baseUrl: CA_URL, headers: intent === 'link' ? caSessionHeader() : {} },
      );
      setFlow({ ...pending, state });
      setStatus('waiting');
    } catch (error) {
      if (state) clearTelegramSignInState(state);
      setStatus('error');
      setMessage(error.message);
    }
  }

  if (status === 'waiting') {
    return (
      <div class="telegram-auth-progress">
        <a class="telegram-auth-link" href={flow.link} target="_blank" rel="noopener noreferrer">{linkLabel || 'Open Telegram'}</a>
        <p role="status">Open the bot, confirm your group membership, then return here. This page is waiting.</p>
        <button type="button" class="telegram-auth-reset" onClick={() => { clearTelegramSignInState(flow.state); setFlow(null); setStatus('idle'); }}>Start again</button>
      </div>
    );
  }

  return (
    <div class="telegram-auth-action">
      <button type="button" data-requires-network onClick={start} disabled={status === 'starting' || status === 'complete'}>
        {status === 'starting' ? 'Preparing…' : buttonLabel || (intent === 'signin' ? 'Continue with Telegram' : 'Connect Telegram')}
      </button>
      {message && <p class={status === 'error' ? 'telegram-auth-error' : ''} role="status">{message}</p>}
      {status === 'error' && <button type="button" class="telegram-auth-reset" onClick={() => { setFlow(null); setStatus('idle'); setMessage(''); }}>Try again</button>}
    </div>
  );
}
