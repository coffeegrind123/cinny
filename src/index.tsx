/* eslint-disable import/first */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import '@fontsource/inter/variable.css';
import 'folds/dist/style.css';
import { configClass, varsClass } from 'folds';

enableMapSet();

import './index.css';

import { trimTrailingSlash } from './app/utils/common';
import App from './app/pages/App';
import { initBlobLinkHandler } from './app/utils/blob-links';

// import i18n (needs to be bundled ;))
import './app/i18n';
import { pushSessionToSW } from './sw-session';
import { getFallbackSession } from './app/state/sessions';

document.body.classList.add(configClass, varsClass);

// Register Service Worker
if ('serviceWorker' in navigator) {
  const swUrl =
    import.meta.env.MODE === 'production'
      ? `${trimTrailingSlash(import.meta.env.BASE_URL)}/sw.js`
      : `/dev-sw.js?dev-sw`;

  const sendSessionToSW = () => {
    const session = getFallbackSession();
    pushSessionToSW(session?.baseUrl, session?.accessToken);
  };

  navigator.serviceWorker.register(swUrl).then((registration) => {
    sendSessionToSW();

    // SW update detection — the web equivalent of the Tauri auto-updater.
    // When the server has a new sw.js (i.e. someone ran `git pull` on the
    // host), `updatefound` fires after the next `registration.update()` call.
    // The SW does `skipWaiting + clients.claim` on install, so the new
    // worker takes over immediately; the page just needs to reload to load
    // the new JS bundle. Surface the event so useUpdateCheck can show a
    // banner.
    registration.addEventListener('updatefound', () => {
      // First install (no existing controller) is not an update.
      if (!navigator.serviceWorker.controller) return;
      window.dispatchEvent(new CustomEvent('cinny:web-update-available'));
    });

    // Browsers only auto-check for SW updates on navigation or once per
    // day. A SPA that stays loaded for hours won't see updates without
    // explicit polling.
    setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
  });
  navigator.serviceWorker.ready.then(sendSessionToSW);

  navigator.serviceWorker.addEventListener('message', (ev) => {
    const { type } = ev.data ?? {};

    if (type === 'requestSession') {
      sendSessionToSW();
    }
  });
}

const mountApp = () => {
  const rootContainer = document.getElementById('root');

  if (rootContainer === null) {
    console.error('Root container element not found!');
    return;
  }

  const root = createRoot(rootContainer);
  root.render(<App />);
};

mountApp();

// Intercept blob: link clicks to trigger download instead of
// trying to open them externally (OS doesn't know blob: scheme)
initBlobLinkHandler();
