import { atom } from 'jotai';
import { MatrixClient } from 'matrix-js-sdk';
import { makeBeaconContent, makeBeaconInfoContent } from 'matrix-js-sdk/lib/content-helpers';
import { M_BEACON, M_BEACON_INFO } from 'matrix-js-sdk/lib/@types/beacon';

/** How often a running share publishes a new position. */
const PUBLISH_INTERVAL_MS = 30000;

export const LIVE_SHARE_DURATIONS = [
  { label: '15 minutes', ms: 15 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '8 hours', ms: 8 * 60 * 60 * 1000 },
];

export type ActiveShare = {
  roomId: string;
  expiresAt: number;
};

/** The live share running right now, if any. */
export const activeShareAtom = atom<ActiveShare | undefined>(undefined);

/**
 * A running location share owns a geolocation watch, a publish interval and a
 * beacon event id. Those live here rather than in a hook because the share is
 * started from a dialog that closes immediately afterwards and stopped from a
 * banner somewhere else entirely — two separate component instances that must
 * be talking about the same broadcast.
 *
 * An earlier version kept this state in a hook. The dialog's unmount cleanup
 * then cancelled the watch the moment it closed, so a share appeared to start
 * and silently published nothing.
 */
type ShareHandles = {
  watchId?: number;
  timerId?: number;
  endTimerId?: number;
  beaconInfoId?: string;
  lastPosition?: GeolocationPosition;
};

const handles: ShareHandles = {};

const clearHandles = () => {
  if (handles.watchId !== undefined) {
    navigator.geolocation.clearWatch(handles.watchId);
    handles.watchId = undefined;
  }
  if (handles.timerId !== undefined) {
    window.clearInterval(handles.timerId);
    handles.timerId = undefined;
  }
  if (handles.endTimerId !== undefined) {
    window.clearTimeout(handles.endTimerId);
    handles.endTimerId = undefined;
  }
  handles.beaconInfoId = undefined;
  handles.lastPosition = undefined;
};

/**
 * Stops publishing and marks the beacon dead.
 *
 * Local teardown happens first and unconditionally: if the state event fails,
 * this device must still stop broadcasting rather than stay live because the
 * network was down.
 */
export const stopLiveShare = async (mx: MatrixClient, roomId: string): Promise<void> => {
  clearHandles();
  try {
    await mx.sendStateEvent(
      roomId,
      M_BEACON_INFO.name as never,
      makeBeaconInfoContent(0, false) as never,
      mx.getSafeUserId(),
    );
  } catch {
    // Viewers fall back to the beacon's own timeout, which is why a timeout is
    // always set when starting.
  }
};

export const startLiveShare = async (
  mx: MatrixClient,
  roomId: string,
  durationMs: number,
  description: string | undefined,
  onEnded: () => void,
): Promise<void> => {
  if (!navigator.geolocation) throw new Error('This device cannot report a location.');

  // Never let two shares run at once — the second watch would keep publishing
  // after the first is stopped.
  clearHandles();

  const stateEvent = await mx.sendStateEvent(
    roomId,
    M_BEACON_INFO.name as never,
    makeBeaconInfoContent(durationMs, true, description) as never,
    mx.getSafeUserId(),
  );
  handles.beaconInfoId = stateEvent.event_id;

  const publish = async () => {
    const position = handles.lastPosition;
    const beaconInfoId = handles.beaconInfoId;
    if (!position || !beaconInfoId) return;
    const uri = `geo:${position.coords.latitude},${position.coords.longitude}`;
    try {
      await mx.sendEvent(
        roomId,
        M_BEACON.name as never,
        makeBeaconContent(uri, position.timestamp, beaconInfoId) as never,
      );
    } catch {
      // A dropped position update is not worth interrupting the share.
    }
  };

  handles.watchId = navigator.geolocation.watchPosition(
    (position) => {
      handles.lastPosition = position;
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 15000 },
  );

  handles.timerId = window.setInterval(publish, PUBLISH_INTERVAL_MS);
  handles.endTimerId = window.setTimeout(() => {
    stopLiveShare(mx, roomId).finally(onEnded);
  }, durationMs);
};
