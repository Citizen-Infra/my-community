import { useEffect, useState } from 'preact/hooks';
import { caSubject, getToken } from '../../extension/src/store/caAuth';
import { deploymentConfig } from '../../extension/src/lib/deployment-config';
import { TelegramSignIn } from './TelegramSignIn';
import { fetchDecision } from './decision-client';
import { renderDecisionMarkdown } from './decision-markdown';
import { routeFromPath } from './routing';

function StatePage({ eyebrow = 'Philanthropic XXI', title, children, action }) {
  return (
    <main class="decision-state-wrap">
      <section class="decision-state" aria-labelledby="decision-state-title">
        <p class="decision-eyebrow">{eyebrow}</p>
        <h1 id="decision-state-title">{title}</h1>
        <div class="decision-state-copy">{children}</div>
        {action}
      </section>
    </main>
  );
}

export function DecisionPage({ decisionPath, online, onNavigate }) {
  const [view, setView] = useState(decisionPath ? 'loading' : 'not-found');
  const [rendered, setRendered] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Decision — Philanthropic XXI';
    return () => { document.title = 'My Community'; };
  }, []);

  useEffect(() => {
    setRendered('');
    if (!decisionPath) { setView('not-found'); return undefined; }
    if (!caSubject.value) { setView('signed-out'); return undefined; }
    if (!online) { setView('unavailable'); return undefined; }

    const controller = new AbortController();
    setView('loading');
    fetchDecision(decisionPath, {
      apiBase: deploymentConfig.decisionApiBase,
      getTokenImpl: getToken,
      signal: controller.signal,
    })
      .then(({ markdown }) => {
        setRendered(renderDecisionMarkdown(markdown, decisionPath));
        setView('readable');
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        if (error?.status === 401) setView('signed-out');
        else if (error?.status === 403) setView('denied');
        else if (error?.status === 404) setView('not-found');
        else setView('unavailable');
      });
    return () => controller.abort();
  }, [decisionPath, online, caSubject.value, attempt]);

  function handleDocumentClick(event) {
    const anchor = event.target.closest?.('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.href, location.origin);
    const route = url.origin === location.origin && !url.search && !url.hash
      ? routeFromPath(url.pathname)
      : null;
    if (route?.mode === 'decision' && route.decisionPath) {
      event.preventDefault();
      onNavigate(route.decisionPath);
    }
  }

  if (view === 'signed-out') {
    return <StatePage title="Read this decision as a member">
      <p>This document belongs to Philanthropic XXI. Confirm your membership with Crapotkin to open it here.</p>
      <TelegramSignIn
        community="philanthropic-xxi"
        buttonLabel="Sign in with Telegram"
        linkLabel="Open Crapotkin"
        onComplete={() => setAttempt((value) => value + 1)}
      />
      <p class="decision-privacy-note">The decision stays on this page while you sign in. Its contents are not saved for offline reading.</p>
    </StatePage>;
  }

  if (view === 'loading') {
    return <StatePage title="Opening the decision">
      <p role="status">Checking membership and requesting the current document…</p>
      <span class="decision-loading-rule" aria-hidden="true" />
    </StatePage>;
  }

  if (view === 'denied') {
    return <StatePage title="This decision is for current members" action={<a class="decision-secondary-action" href="/">Back to community</a>}>
      <p>Your account is signed in, but it does not currently have Philanthropic XXI membership.</p>
    </StatePage>;
  }

  if (view === 'not-found') {
    return <StatePage title="This decision isn’t available" action={<a class="decision-secondary-action" href="/">Back to community</a>}>
      <p>The link may be incomplete, or the decision may have moved.</p>
    </StatePage>;
  }

  if (view === 'unavailable') {
    return <StatePage title="The decision couldn’t be opened" action={<button type="button" class="decision-primary-action" data-requires-network onClick={() => setAttempt((value) => value + 1)} disabled={!online}>Try again</button>}>
      <p>{online ? 'The member document service is temporarily unavailable. No saved copy has been shown.' : 'Reconnect to request a fresh member-only copy.'}</p>
    </StatePage>;
  }

  return (
    <main class="decision-reader">
      <div class="decision-reader-nav">
        <a href="/" class="decision-back"><span aria-hidden="true">←</span> Back to community</a>
        <span>Philanthropic XXI</span>
      </div>
      <article class="decision-document" onClick={handleDocumentClick} dangerouslySetInnerHTML={{ __html: rendered }} />
      <footer class="decision-footer"><a href="/">Philanthropic XXI community dashboard</a></footer>
    </main>
  );
}
