import { createClient, MatrixClient, IndexedDBStore, IndexedDBCryptoStore } from 'matrix-js-sdk';

import { cryptoCallbacks } from './secretStorageKeys';
import { clearNavToActivePathStore } from '../app/state/navToActivePath';
import { pushSessionToSW } from '../sw-session';
import { isTauri } from '../app/utils/desktop-notifications';

type Session = {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string;
};

export const initClient = async (session: Session): Promise<MatrixClient> => {
  const indexedDBStore = new IndexedDBStore({
    indexedDB: global.indexedDB,
    localStorage: global.localStorage,
    dbName: 'web-sync-store',
  });

  const legacyCryptoStore = new IndexedDBCryptoStore(global.indexedDB, 'crypto-store');

  const mx = createClient({
    baseUrl: session.baseUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    store: indexedDBStore,
    cryptoStore: legacyCryptoStore,
    deviceId: session.deviceId,
    timelineSupport: true,
    cryptoCallbacks: cryptoCallbacks as any,
    verificationMethods: ['m.sas.v1'],
  });

  // Hand the token to the service worker as soon as we have a client for it.
  // Boot-time pushes happen before login, so on a fresh sign-in the worker would
  // otherwise hold nothing until a media fetch made it ask — and the answer to
  // that question races the login it is waiting on.
  pushSessionToSW(session.baseUrl, session.accessToken);

  await indexedDBStore.startup();
  await mx.initRustCrypto();

  mx.setMaxListeners(50);

  // Tell the native shell which homeserver origin this session is actually
  // connected to. `cache_notification_icon` needs to know whether it may relax
  // its private-address guard — a homeserver may legitimately sit on a LAN
  // address — and it must not take that answer from the arguments of the call
  // being guarded, because those come from the page. Registering the origin once
  // here, from the session the client was constructed with, is what makes the
  // check meaningful. If this never runs the native side simply applies the
  // guard, so a web build (or a failed invoke) stays safe.
  await registerHomeserverOriginWithShell(session.baseUrl);

  return mx;
};

const registerHomeserverOriginWithShell = async (baseUrl: string): Promise<void> => {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_homeserver_origin', { origin: baseUrl });
  } catch (err) {
    // Non-fatal: the native side falls back to enforcing the guard.
    console.warn('[shell] set_homeserver_origin failed:', err);
  }
};

export const startClient = async (mx: MatrixClient) => {
  await mx.startClient({
    lazyLoadMembers: true,
  });
};

export const clearCacheAndReload = async (mx: MatrixClient) => {
  mx.stopClient();
  clearNavToActivePathStore(mx.getSafeUserId());
  await mx.store.deleteAllData();
  window.location.reload();
};

export const logoutClient = async (mx: MatrixClient) => {
  pushSessionToSW();
  mx.stopClient();
  try {
    await mx.logout();
  } catch {
    // ignore if failed to logout
  }
  await mx.clearStores();
  window.localStorage.clear();
  window.location.reload();
};

export const clearLoginData = async () => {
  const dbs = await window.indexedDB.databases();

  dbs.forEach((idbInfo) => {
    const { name } = idbInfo;
    if (name) {
      window.indexedDB.deleteDatabase(name);
    }
  });

  window.localStorage.clear();
  window.location.reload();
};
