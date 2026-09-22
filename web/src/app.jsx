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
import { routeFromPath, pathForDashboardRoute } from './routing';
import { WebTopBar } from './WebTopBar';
import { WebSettings } from './WebSettings';
import { canUseNetworkAction } from './offline-policy';
import { clearCommunityBlueskySignIn, consumeCommunityBlueskySignIn } from './bluesky-signin-intent';
import { deploymentConfig } from '../../extension/src/lib/deployment-config';
import './web.css';

export function App() {
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [settingsOpen, setSettingsOpen] = useState(routeFromPath(location.pathname).settings === true);
  const [authError, setAuthError] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const preferenceAccount = useRef(null);
  useDashboardFeeds(ready);

  function applyRoute(route, { replace = false, push = false } = {}) {
    if (push || replace) history[replace ? 'replaceState' : 'pushState']({ mcRoute: true }, '', route.settings ? '/settings' : pathForDashboardRoute(route));
    setSettingsOpen(route.settings === true);
    applyDashboardRoute(route);
  }

  useEffect(() => {
    initTheme();
    const initialRoute = routeFromPath(location.pathname);
    applyDashboardRoute(initialRoute);
    setDashboardNavigator((route) => {
      const nextPath = pathForDashboardRoute(route);
      applyRoute(route, { push: location.pathname !== nextPath });
    });
    const onPopState = () => applyRoute(routeFromPath(location.pathname));
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstallable = (event) => { event.preventDefault(); setInstallPrompt(event); };
    addEventListener('popstate', onPopState);
    addEventListener('online', onOnline);
    addEventListener('offline', onOffline);
    addEventListener('beforeinstallprompt', onInstallable);

    (async () => {
      try {
        if (initialRoute.callback === 'email') {
          const params = new URLSearchParams(location.search);
          await exchangeWebSignIn(params.get('code'), params.get('state'));
          history.replaceState({}, '', '/');
          applyDashboardRoute({ mode: 'overview' });
        } else if (initialRoute.callback === 'atproto' && deploymentConfig.blueskyEnabled) {
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
    if (!ready) return;
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
  }, [ready, caSubject.value]);

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

  if (!ready) return <div class="loading-screen" role="status"><span class="loading-mark">My Community</span><span class="loading-rule" aria-hidden="true" /><span class="loading-line">Setting today’s page</span></div>;

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
