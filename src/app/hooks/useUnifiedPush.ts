import { useEffect, useRef } from 'react';
import { MatrixClient } from 'matrix-js-sdk';
import { isTauri } from '../utils/desktop-notifications';
import {
  registerUnifiedPush,
  getUnifiedPushEndpoint,
  onEndpointReceived,
  onPushMessage,
  onUnregistered,
  startForegroundService,
  stopForegroundService,
} from '../utils/mobile-push';

const UP_APP_ID = 'in.cinny.app.unifiedpush';

/**
 * Registers the UnifiedPush endpoint as a Matrix HTTP pusher.
 */
async function registerMatrixPusher(mx: MatrixClient, endpoint: string) {
  try {
    await mx.setPusher({
      kind: 'http',
      app_id: UP_APP_ID,
      pushkey: endpoint,
      app_display_name: 'Cinny',
      device_display_name: 'Cinny Android',
      lang: 'en',
      data: {
        url: endpoint,
        format: 'event_id_only',
      },
      append: false,
    });
  } catch (err) {
    console.warn('[UnifiedPush] Failed to register Matrix pusher:', err);
  }
}

/**
 * Sets up UnifiedPush for this Matrix client session.
 *
 * - Registers with a UP distributor (or reuses existing endpoint)
 * - Registers the endpoint as a Matrix HTTP pusher
 * - Listens for incoming push messages and triggers Matrix sync
 * - Listens for endpoint rotation and re-registers the pusher
 */
export function useUnifiedPush(mx: MatrixClient | undefined) {
  const setupDone = useRef(false);

  useEffect(() => {
    if (!mx || !mx.clientRunning || setupDone.current) return;

    // Only run on Tauri (Android)
    if (!isTauri()) {
      return;
    }

    setupDone.current = true;

    let unsubMessage: (() => void) | undefined;
    let unsubEndpoint: (() => void) | undefined;
    let unsubUnregistered: (() => void) | undefined;

    async function setup() {
      // 0. Start foreground service to keep Matrix WebSocket alive in background
      try {
        await startForegroundService();
        console.log('[UnifiedPush] Foreground service started');
      } catch (err) {
        console.warn('[UnifiedPush] Foreground service failed to start:', err);
      }

      // 1. Try existing endpoint first
      let endpoint = await getUnifiedPushEndpoint().catch(() => null);

      // 2. If no saved endpoint, register with UP distributor
      if (!endpoint) {
        try {
          endpoint = await registerUnifiedPush();
        } catch (err) {
          console.warn('[UnifiedPush] Registration failed, no distributor available:', err);
          return;
        }
      }

      if (endpoint) {
        await registerMatrixPusher(mx, endpoint);
      }

      // 3. Listen for new endpoints (rotation)
      onEndpointReceived(async (newEndpoint) => {
        await registerMatrixPusher(mx, newEndpoint);
      }).then((unsub) => { unsubEndpoint = unsub; });

      // 4. Listen for push messages — trigger sync
      onPushMessage(() => {
        mx.sync();
      }).then((unsub) => { unsubMessage = unsub; });

      // 5. Listen for unregistration
      onUnregistered(() => {
        console.log('[UnifiedPush] Unregistered from distributor');
      }).then((unsub) => { unsubUnregistered = unsub; });
    }

    setup();

    return () => {
      unsubMessage?.();
      unsubEndpoint?.();
      unsubUnregistered?.();
      stopForegroundService().catch(() => {});
    };
  }, [mx?.clientRunning]);
}
