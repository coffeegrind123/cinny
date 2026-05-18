/// <reference lib="WebWorker" />

export type {};
declare const self: ServiceWorkerGlobalScope;

type SessionInfo = {
  accessToken: string;
  baseUrl: string;
};

/**
 * Store session per client (tab)
 */
const sessions = new Map<string, SessionInfo>();

const clientToResolve = new Map<string, (value: SessionInfo | undefined) => void>();
const clientToSessionPromise = new Map<string, Promise<SessionInfo | undefined>>();

async function cleanupDeadClients() {
  const activeClients = await self.clients.matchAll();
  const activeIds = new Set(activeClients.map((c) => c.id));

  Array.from(sessions.keys()).forEach((id) => {
    if (!activeIds.has(id)) {
      sessions.delete(id);
      clientToResolve.delete(id);
      clientToSessionPromise.delete(id);
    }
  });
}

function setSession(clientId: string, accessToken: any, baseUrl: any) {
  if (typeof accessToken === 'string' && typeof baseUrl === 'string') {
    sessions.set(clientId, { accessToken, baseUrl });
  } else {
    // Logout or invalid session
    sessions.delete(clientId);
  }

  const resolveSession = clientToResolve.get(clientId);
  if (resolveSession) {
    resolveSession(sessions.get(clientId));
    clientToResolve.delete(clientId);
    clientToSessionPromise.delete(clientId);
  }
}

function requestSession(client: Client): Promise<SessionInfo | undefined> {
  const promise =
    clientToSessionPromise.get(client.id) ??
    new Promise((resolve) => {
      clientToResolve.set(client.id, resolve);
      client.postMessage({ type: 'requestSession' });
    });

  if (!clientToSessionPromise.has(client.id)) {
    clientToSessionPromise.set(client.id, promise);
  }

  return promise;
}

async function requestSessionWithTimeout(
  clientId: string,
  timeoutMs = 3000
): Promise<SessionInfo | undefined> {
  const client = await self.clients.get(clientId);
  if (!client) return undefined;

  const sessionPromise = requestSession(client);

  const timeout = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), timeoutMs);
  });

  return Promise.race([sessionPromise, timeout]);
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      await cleanupDeadClients();
    })()
  );
});

/**
 * Receive session updates from clients
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const client = event.source as Client | null;
  if (!client) return;

  const { type, accessToken, baseUrl } = event.data || {};

  if (type === 'setSession') {
    setSession(client.id, accessToken, baseUrl);
    cleanupDeadClients();
  }
});

const MEDIA_PATHS = ['/_matrix/client/v1/media/download', '/_matrix/client/v1/media/thumbnail'];

function mediaPath(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    return MEDIA_PATHS.some((p) => pathname.startsWith(p));
  } catch {
    return false;
  }
}

function validMediaRequest(url: string, baseUrl: string): boolean {
  return MEDIA_PATHS.some((p) => {
    const validUrl = new URL(p, baseUrl);
    return url.startsWith(validUrl.href);
  });
}

function fetchConfig(token: string): RequestInit {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'default',
  };
}

// ── Web Push ──────────────────────────────────────────────────────────
//
// Triggered when a Matrix push gateway (e.g. Sygnal's webpush pushkin)
// delivers a notification while the tab is closed/backgrounded. The
// payload shape depends on the gateway — we cover the common cases:
//
//   {                                       // Sygnal webpush format
//     notification: { event_id, room_id, sender, room_name, content: { body }, ... }
//   }
//
//   { title, body, roomId, eventId }        // flat custom-gateway format
//
// With Matrix's `format: "event_id_only"` pusher option, the gateway
// strips the message body for privacy — we show "New message" instead.

interface MatrixPushNotification {
  event_id?: string;
  room_id?: string;
  sender?: string;
  sender_display_name?: string;
  room_name?: string;
  room_alias?: string;
  content?: { body?: string; msgtype?: string };
  counts?: { unread?: number; missed_calls?: number };
}

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event: PushEvent) {
  let payload: any = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    // Some gateways send plain text or empty payload
    payload = { title: 'New message' };
  }

  const notif: MatrixPushNotification = payload.notification ?? payload;
  const sender = notif.sender_display_name || notif.sender || '';
  const title = notif.room_name || notif.room_alias || sender || payload.title || 'New message';
  const body =
    notif.content?.body ||
    payload.body ||
    (sender && notif.room_name ? `${sender}: …` : 'You have a new message');

  await self.registration.showNotification(title, {
    body,
    icon: '/public/res/svg/cinny.svg',
    badge: '/public/res/svg/cinny.svg',
    tag: notif.event_id || payload.eventId || 'matrix-push',
    renotify: true,
    data: {
      roomId: notif.room_id || payload.roomId,
      eventId: notif.event_id || payload.eventId,
    },
  } as NotificationOptions);
}

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const { roomId, eventId } = (event.notification.data || {}) as { roomId?: string; eventId?: string };

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Focus an existing tab and let it route — avoids opening duplicates.
      const existing = allClients.find((c) => c.url.startsWith(self.registration.scope));
      if (existing) {
        try {
          await (existing as WindowClient).focus();
        } catch {
          // focus() can reject on some browsers if not user-activated
        }
        existing.postMessage({ type: 'notificationClick', roomId, eventId });
        return;
      }

      // No open tab — launch fresh. Pass the roomId via hash so the
      // bootstrapping app code can route once it's mounted.
      const url = roomId
        ? `${self.registration.scope}#/notification-target?roomId=${encodeURIComponent(roomId)}`
        : self.registration.scope;
      await self.clients.openWindow(url);
    })()
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { url, method } = event.request;

  if (method !== 'GET' || !mediaPath(url)) return;

  const { clientId } = event;
  if (!clientId) return;

  const session = sessions.get(clientId);
  if (session) {
    if (validMediaRequest(url, session.baseUrl)) {
      event.respondWith(fetch(url, fetchConfig(session.accessToken)));
    }
    return;
  }

  event.respondWith(
    requestSessionWithTimeout(clientId).then((s) => {
      if (s && validMediaRequest(url, s.baseUrl)) {
        return fetch(url, fetchConfig(s.accessToken));
      }
      return fetch(event.request);
    })
  );
});
