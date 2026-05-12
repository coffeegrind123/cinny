/**
 * UnifiedPush integration for Android (GrapheneOS / de-Googled devices).
 *
 * Flow:
 *   1. registerWithDistributor() → picks a UP distributor, gets endpoint URL
 *   2. Register the endpoint as a Matrix pusher via POST /pushers/set
 *   3. When a push arrives, Matrix sync runs and fires normal notification handlers
 *
 * Falls back to FCM via tauri-plugin-mobile-push on devices with Play Services.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface UnifiedPushEndpoint {
  endpoint: string;
}

/**
 * Register this device with a UnifiedPush distributor.
 * Returns the endpoint URL to send to the Matrix homeserver.
 */
export async function registerUnifiedPush(): Promise<string> {
  const result = await invoke<UnifiedPushEndpoint>('plugin:unifiedpush|register');
  return result.endpoint;
}

/**
 * Get the currently saved endpoint (if already registered).
 */
export async function getUnifiedPushEndpoint(): Promise<string | null> {
  try {
    const result = await invoke<UnifiedPushEndpoint>('plugin:unifiedpush|get_endpoint');
    return result.endpoint;
  } catch {
    return null;
  }
}

/**
 * Listen for new UnifiedPush endpoints (arrives after registration).
 */
export function onEndpointReceived(callback: (endpoint: string) => void): Promise<UnlistenFn> {
  return listen<{ endpoint: string }>('endpoint-received', (event) => {
    callback(event.payload.endpoint);
  });
}

/**
 * Listen for incoming UnifiedPush messages.
 * Callback receives the raw message body as a UTF-8 string.
 */
export function onPushMessage(callback: (body: string) => void): Promise<UnlistenFn> {
  return listen<{ body: string }>('message-received', (event) => {
    callback(event.payload.body);
  });
}

/**
 * Listen for UnifiedPush unregistration events.
 */
export function onUnregistered(callback: () => void): Promise<UnlistenFn> {
  return listen('unregistered', callback);
}

/**
 * Listen for UnifiedPush registration failures.
 */
export function onRegistrationFailed(callback: (reason: string) => void): Promise<UnlistenFn> {
  return listen<{ reason: string }>('registration-failed', (event) => {
    callback(event.payload.reason);
  });
}
