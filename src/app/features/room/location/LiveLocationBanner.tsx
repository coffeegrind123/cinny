import { useCallback, useMemo } from 'react';
import { Box, Button, Icon, Icons, Text, color, config } from 'folds';
import { useAtom } from 'jotai';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useLiveBeacons } from '../../../hooks/useLiveBeacons';
import { getMemberDisplayName } from '../../../utils/room';
import { getMxIdLocalPart } from '../../../utils/matrix';
import { useMapStyleUrl, useMapsEnabled } from '../../../hooks/useMapStyleUrl';
import { MapView } from '../../../components/map';
import { activeShareAtom, startLiveShare, stopLiveShare } from '../../../plugins/live-location';

export { LIVE_SHARE_DURATIONS } from '../../../plugins/live-location';

/**
 * Start/stop control over the single live share this client can run.
 *
 * State lives in a module singleton rather than in the hook so that the dialog
 * which starts a share and the banner which stops it are operating on the same
 * broadcast — see plugins/live-location.ts.
 */
export const useLiveLocationShare = (room: Room) => {
  const mx = useMatrixClient();
  const [activeShare, setActiveShare] = useAtom(activeShareAtom);

  const start = useCallback(
    async (durationMs: number, description?: string) => {
      await startLiveShare(mx, room.roomId, durationMs, description, () =>
        setActiveShare(undefined),
      );
      setActiveShare({ roomId: room.roomId, expiresAt: Date.now() + durationMs });
    },
    [mx, room.roomId, setActiveShare],
  );

  const stop = useCallback(async () => {
    setActiveShare(undefined);
    await stopLiveShare(mx, room.roomId);
  }, [mx, room.roomId, setActiveShare]);

  return {
    sharing: activeShare?.roomId === room.roomId,
    start,
    stop,
  };
};

type LiveLocationBannerProps = {
  room: Room;
};

/**
 * Shows live location shares running in this room, including your own.
 *
 * Deliberately not dismissible while you are the one sharing: a background
 * process broadcasting your position is the one thing in this client that must
 * never be possible to forget about. It can be stopped, not hidden.
 *
 * The map draws only when the viewer has opted into maps; the banner still
 * reports who is sharing either way, because that fact matters whether or not
 * you want tiles fetched.
 */
export function LiveLocationBanner({ room }: LiveLocationBannerProps) {
  const mx = useMatrixClient();
  const beacons = useLiveBeacons(room);
  const mapsEnabled = useMapsEnabled();
  const styleUrl = useMapStyleUrl();
  const { sharing, stop } = useLiveLocationShare(room);

  const pins = useMemo(
    () =>
      beacons
        .filter((entry) => entry.latitude !== undefined && entry.longitude !== undefined)
        .map((entry) => ({
          latitude: entry.latitude as number,
          longitude: entry.longitude as number,
          live: true,
        })),
    [beacons],
  );

  // Show the banner while this client is publishing even before the first
  // beacon lands, so "am I still sharing?" is always answerable on screen.
  if (beacons.length === 0 && !sharing) return null;

  const mine = sharing || beacons.some((entry) => entry.ownerId === mx.getUserId());
  const others = beacons.filter((entry) => entry.ownerId !== mx.getUserId());

  return (
    <Box
      direction="Column"
      gap="200"
      style={{
        padding: config.space.S200,
        margin: `0 ${config.space.S200}`,
        backgroundColor: color.Success.Container,
        color: color.Success.OnContainer,
        borderRadius: config.radii.R300,
      }}
    >
      <Box alignItems="Center" gap="200">
        <Box shrink="No">
          <Icon size="50" src={Icons.Pin} />
        </Box>
        <Box grow="Yes" direction="Column" style={{ minWidth: 0 }}>
          <Text size="T200">
            {mine
              ? 'You are sharing your live location'
              : `${others.length} live location${others.length === 1 ? '' : 's'} shared`}
          </Text>
          {others.length > 0 && (
            <Text size="T200" priority="300" truncate>
              {others
                .map(
                  (entry) =>
                    getMemberDisplayName(room, entry.ownerId) ??
                    getMxIdLocalPart(entry.ownerId) ??
                    entry.ownerId,
                )
                .join(', ')}
            </Text>
          )}
        </Box>
        {mine && (
          <Box shrink="No">
            <Button size="300" radii="300" variant="Critical" fill="Soft" onClick={() => stop()}>
              <Text size="B300">Stop sharing</Text>
            </Button>
          </Box>
        )}
      </Box>

      {mapsEnabled && styleUrl && pins.length > 0 && (
        <MapView styleUrl={styleUrl} pins={pins} height="160px" interactive />
      )}
      {!mapsEnabled && pins.length > 0 && (
        <Text size="T200" priority="300">
          Turn on maps in Settings to see where.
        </Text>
      )}
    </Box>
  );
}
