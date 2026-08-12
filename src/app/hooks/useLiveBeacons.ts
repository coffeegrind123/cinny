import { useCallback, useEffect, useState } from 'react';
import { Beacon, BeaconEvent, Room, RoomStateEvent } from 'matrix-js-sdk';

export type LiveBeacon = {
  beacon: Beacon;
  ownerId: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  /** When the share stops, as a timestamp. */
  expiresAt: number;
};

const parseGeoUri = (
  uri: string | undefined,
): { latitude: number; longitude: number } | undefined => {
  if (!uri) return undefined;
  const match = uri.match(/^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  return { latitude, longitude };
};

/**
 * Live location shares currently running in a room (MSC3672).
 *
 * The sdk keeps beacon state on the room and emits as new positions arrive, so
 * this subscribes rather than polling. A beacon whose timeout has passed is
 * dropped even if its owner never sent the closing state event — that happens
 * whenever someone's phone dies mid-share, and showing a stale position as
 * "live" is worse than showing nothing.
 */
export const useLiveBeacons = (room: Room): LiveBeacon[] => {
  // The sdk mutates beacon state in place, so this counter is the only signal
  // that the derived list below needs rebuilding. Its value is never read.
  const [, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    const state = room.currentState;
    state.on(BeaconEvent.New, bump);
    state.on(BeaconEvent.Update, bump);
    state.on(BeaconEvent.LivenessChange, bump);
    state.on(BeaconEvent.LocationUpdate, bump);
    state.on(RoomStateEvent.BeaconLiveness, bump);

    // Liveness is time-based, so nothing emits at the moment a share expires.
    const timer = window.setInterval(bump, 30000);

    return () => {
      state.off(BeaconEvent.New, bump);
      state.off(BeaconEvent.Update, bump);
      state.off(BeaconEvent.LivenessChange, bump);
      state.off(BeaconEvent.LocationUpdate, bump);
      state.off(RoomStateEvent.BeaconLiveness, bump);
      window.clearInterval(timer);
    };
  }, [room, bump]);

  return Array.from(room.currentState.beacons.values())
    .filter((beacon) => beacon.isLive)
    .map((beacon) => {
      const { beaconInfo } = beacon;
      const expiresAt = (beaconInfo?.timestamp ?? 0) + (beaconInfo?.timeout ?? 0);
      const position = parseGeoUri(beacon.latestLocationState?.uri);
      return {
        beacon,
        ownerId: beacon.beaconInfoOwner,
        description: beaconInfo?.description,
        latitude: position?.latitude,
        longitude: position?.longitude,
        expiresAt,
      };
    })
    .filter((entry) => entry.expiresAt === 0 || entry.expiresAt > Date.now())
    .sort((a, b) => a.expiresAt - b.expiresAt);
};
