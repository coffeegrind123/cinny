import { useCallback } from 'react';
import { Box, Switch, Text } from 'folds';
import { useAtomValue } from 'jotai';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { SequenceCardStyle } from '../styles.css';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { richPresenceBridgeStatusAtom } from '../../../state/richPresenceBridge';
import { useTauriDesktop } from '../../../hooks/useTauriDesktop';

export function RichPresencePublish() {
  const [enabled, setEnabled] = useSetting(settingsAtom, 'publishRichPresence');
  const status = useAtomValue(richPresenceBridgeStatusAtom);
  const desktop = useTauriDesktop();

  const handleChange = useCallback((value: boolean) => setEnabled(value), [setEnabled]);

  let statusText: string | undefined;
  if (desktop && enabled && status) {
    if (status.state === 'starting') {
      statusText = 'Starting…';
    } else if (status.state === 'running') {
      statusText =
        status.index === 0
          ? `Listening on ${status.path}`
          : `Listening on ${status.path}, but another RPC server owns a lower slot — close Discord or arRPC to receive activity`;
    } else if (status.state === 'error') {
      statusText = `Failed: ${status.error}`;
    }
  }

  return (
    <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
      <SettingTile
        title="Publish rich presence"
        description={
          <Box direction="Column" gap="100">
            <Text size="T200" priority="300">
              {desktop
                ? "Impersonate Discord's local RPC server so media players and games broadcast their activity as your Matrix rich presence (MSC4320). Off by default for privacy; needs MSC4133 extended profiles on your homeserver."
                : 'Desktop only. A browser cannot listen on the Discord RPC pipe.'}
            </Text>
            {statusText && (
              <Text size="T200" priority="300">
                {statusText}
              </Text>
            )}
          </Box>
        }
        after={
          <Switch variant="Primary" value={enabled} onChange={handleChange} disabled={!desktop} />
        }
      />
    </SequenceCard>
  );
}
