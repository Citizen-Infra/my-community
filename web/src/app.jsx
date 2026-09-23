import { useEffect, useRef, useState } from 'preact/hooks';
import { initTheme } from '../../extension/src/store/theme';
import { initAuth, disconnectBluesky } from '../../extension/src/store/auth';
import { initCaAuth, caSubject, exchangeWebSignIn, requestBlueskySignIn } from '../../extension/src/store/caAuth';
import { loadCommunities } from '../../extension/src/store/communities';
import { Dashboard } from '../../extension/src/components/Dashboard';
import { JamBanner } from '../../extension/src/components/JamBanner';
import { PreferenceReconciliation } from '../../extension/src/components/PreferenceReconciliation';
import { hydrateDashboard, useDashboardFeeds } from '../../extension/src/dashboard-runtime';
import { applyDashboardRoute, setDashboardNavigator, toggleDashboardCustomization } from '../../extension/src/store/panels';
import { beginPreferenceContinuity, endPreferenceContinuity, startSignedOutPreferenceProfile } from '../../extension/src/store/preferences';
import { completeBlueskyLogin } from '../../extension/src/lib/oauth-atproto';
import { pathForDashboardRoute, pathForDecisionRoute, routeFromPath } from './routing';
import { WebTopBar } from './WebTopBar';
import { WebSettings } from './WebSettings';
import { DecisionPage } from './DecisionPage';
import { canUseNetworkAction } from './offline-policy';
import { clearCommunityBlueskySignIn, consumeCommunityBlueskySignIn } from './bluesky-signin-intent';
import { deploymentConfig } from '../../extension/src/lib/deployment-config';
import './web.css';
import './pxxi-brand.css';

export function App() {
  const initialRoute = useRef(routeFromPath(location.pathname));
  const [decisionRoute, setDecisionRoute] = useState(initialRoute.current.mode === 'decision' ? initialRoute.current : null);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [settingsOpen, setSettingsOpen] = useState(routeFromPath(location.pathname).settings === true);
  const [authError, setAuthError] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const preferenceAccount = useRef(null);
  useDashboardFeeds(ready && !decisionRoute);

  function applyRoute(route, { replace = false, push = false } = {}) {
    if (push || replace) history[replace ? 'replaceState' : 'pushState']({ mcRoute: true }, '', route.settings ? '/settings' : pathForDashboardRoute(route));
    setSettingsOpen(route.settings === true);
    applyDashboardRoute(route);
  }

  useEffect(() => {
    initTheme();
    const routeAtBoot = initialRoute.current;
    const decisionOnly = routeAtBoot.mode === 'decision';
    if (!decisionOnly) {
      applyDashboardRoute(routeAtBoot);
      setDashboardNavigator((route) => {
        const nextPath = pathForDashboardRoute(route);
        applyRoute(route, { push: location.pathname !== nextPath });
      });
    }
    const onPopState = () => {
      const nextRoute = routeFromPath(location.pathname);
      if (decisionOnly) {
        if (nextRoute.mode === 'decision') setDecisionRoute(nextRoute);
        else location.reload();
      } else {
        applyRoute(nextRoute);
      }
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallable = (event) => { event.preventDefault(); setInstallPrompt(event); };
    addEventListener('popstate', onPopState);
    addEventListener('online', onOnline);
    addEventListener('offline', onOffline);
    addEventListener('beforeinstallprompt', onInstallable);

    (async () => {
      try {
        if (decisionOnly) {
          await initCaAuth();
          setReady(true);
          return;
        }
        if (routeAtBoot.callback === 'email') {
          const params = new URLSearchParams(location.search);
          await exchangeWebSignIn(params.get('code'), params.get('state'));
          history.replaceState({}, '', '/');
          applyDashboardRoute({ mode: 'overview' });
        } else if (routeAtBoot.callback === 'atproto' && deploymentConfig.blueskyEnabled) {
          await completeBlueskyLogin(location.href);
          await initAuth();
          if (consumeCommunityBlueskySignIn()) {
            await requestBlueskySignIn();
          }
          history.replaceState({}, '', '/');
          applyDashboardRoute({ mode: 'overview' });
        }
        await initCaAuth();
        await Promise.all([loadCommunities(), initAuth()]);
        hydrateDashboard();
        setReady(true);
      } catch (error) {
        if (decisionOnly) {
          setAuthError('Member access could not be checked. Try again.');
          setReady(true);
          return;
        }
        clearCommunityBlueskySignIn();
        setAuthError(error.message || 'Sign-in could not be completed.');
        history.replaceState({}, '', '/');
        await initCaAuth();
        await Promise.all([initAuth(), loadCommunities()]);
        hydrateDashboard();
        setReady(true);
      }
    })();

    if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    return () => {
      setDashboardNavigator(null);
      removeEventListener('popstate', onPopState);
      removeEventListener('online', onOnline);
      removeEventListener('offline', onOffline);
      removeEventListener('beforeinstallprompt', onInstallable);
    };
  }, []);

  useEffect(() => {
    if (!ready || decisionRoute) return;
    const account = caSubject.value;
    if (account && preferenceAccount.current !== account) {
      preferenceAccount.current = account;
      void beginPreferenceContinuity(account);
    } else if (!account && preferenceAccount.current) {
      preferenceAccount.current = null;
      endPreferenceContinuity();
      void disconnectBluesky();
    } else if (!account) {
      startSignedOutPreferenceProfile();
    }
  }, [ready, decisionRoute, caSubject.value]);

  function openSettings() { applyRoute({ mode: 'overview', settings: true }, { push: true }); }
  function openOverview() { applyRoute({ mode: 'overview' }, { push: true }); }
  function customizeDashboard() {
    toggleDashboardCustomization();
  }
  function closeSettings() {
    if (location.pathname === '/settings' && history.state?.mcRoute) history.back();
    else applyRoute({ mode: 'overview' }, { replace: true });
  }
  async function install() {
    await installPrompt?.prompt();
    setInstallPrompt(null);
  }
  function guardOffline(event) {
    if (canUseNetworkAction(online, 'outward-action')) return;
    if (event.type === 'submit' || event.target.closest('a[href], button[data-requires-network], .auth-submit')) {
      event.preventDefault();
      event.stopPropagation();
      setAuthError('You are offline. Cached community pages remain readable; actions will return when you reconnect.');
    }
  }

  function navigateToDecision(decisionPath) {
    const nextPath = pathForDecisionRoute(decisionPath);
    history.pushState({ mcRoute: true }, '', nextPath);
    setDecisionRoute({ mode: 'decision', decisionPath });
    scrollTo({ top: 0, behavior: 'auto' });
  }

  if (!ready) return <div class="loading-screen" role="status"><span class="loading-mark">{deploymentConfig.brand.name}</span><span class="loading-rule" aria-hidden="true" /><span class="loading-line">{deploymentConfig.brand.loadingLine}</span></div>;

  if (decisionRoute) {
    return <div class={`decision-shell ${online ? '' : 'is-offline'}`}><DecisionPage decisionPath={decisionRoute.decisionPath} online={online} onNavigate={navigateToDecision} /></div>;
  }

  return (
    <div class={`web-shell ${online ? '' : 'is-offline'}`} onClickCapture={guardOffline} onSubmitCapture={guardOffline}>
      <WebTopBar online={online} onOpenSettings={openSettings} onOpenOverview={openOverview} />
      <JamBanner />
      {(authError || !online) && <div class="web-notice" role="status"><span>{authError || 'Offline — showing matching saved content. Actions are paused.'}</span>{authError && <button type="button" onClick={() => setAuthError('')}>Dismiss</button>}</div>}
      <div class="web-main"><Dashboard onOpenSettings={openSettings} /></div>
      {settingsOpen && <WebSettings onClose={closeSettings} onCustomize={customizeDashboard} onInstall={install} canInstall={!!installPrompt} />}
      <PreferenceReconciliation />
    </div>
  );
}
