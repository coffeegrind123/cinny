import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Switch, Text, color, config } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import { acquireMicrophone } from '../../../utils/capture';
import { useMicrophonePermission } from '../../../hooks/useMicrophonePermission';

type Device = { deviceId: string; label: string };

/**
 * Microphone selection and processing, used by voice messages and calls.
 *
 * Device labels are only exposed by the browser once a capture permission has
 * been granted, so before that the list is a set of anonymous ids that nobody
 * can choose between. Rather than showing that, the list stays hidden behind a
 * button that asks for the microphone once and then populates properly.
 */
export function AudioSettings() {
  const [audioInputId, setAudioInputId] = useSetting(settingsAtom, 'audioInputId');
  const [echoCancellation, setEchoCancellation] = useSetting(settingsAtom, 'echoCancellation');
  const [noiseSuppression, setNoiseSuppression] = useSetting(settingsAtom, 'noiseSuppression');
  const [autoGainControl, setAutoGainControl] = useSetting(settingsAtom, 'autoGainControl');

  const micPermission = useMicrophonePermission();

  const [devices, setDevices] = useState<Device[]>([]);
  const [labelled, setLabelled] = useState(false);
  const [error, setError] = useState<string>();

  const loadDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const all = await navigator.mediaDevices.enumerateDevices();
    const inputs = all
      .filter((device) => device.kind === 'audioinput')
      .map((device) => ({ deviceId: device.deviceId, label: device.label }));
    setDevices(inputs);
    setLabelled(inputs.some((device) => device.label !== ''));
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const revealDevices = useCallback(async () => {
    setError(undefined);
    try {
      // Opening and immediately releasing the microphone is what makes the
      // browser hand over device labels.
      const mic = await acquireMicrophone();
      mic.release();
      await loadDevices();
    } catch {
      setError('Microphone access was refused, so device names cannot be shown.');
    }
  }, [loadDevices]);

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Microphone</Text>

      {/*
        The permission gets a row of its own rather than living only behind the
        first recording. A permission you can only reach by starting to do the
        thing it guards is one you cannot fix after saying no by accident, and
        on mobile the platform prompt is offered exactly once.
      */}
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Microphone access"
          description={
            micPermission.state === 'denied' ? (
              <Text as="span" style={{ color: color.Critical.Main }} size="T200">
                Refused. Ask again to raise the prompt once more — if none appears, allow the
                microphone for Prinny in your system settings.
              </Text>
            ) : micPermission.state === 'granted' ? (
              <span>Allowed. Used for voice messages and calls, only while recording.</span>
            ) : (
              <span>Needed for voice messages and calls. Opened only while recording.</span>
            )
          }
          after={
            micPermission.state === 'granted' ? (
              <Text size="T200" priority="300">
                Allowed
              </Text>
            ) : (
              // Still enabled after a refusal, deliberately — see
              // MicPermissionDialog: Android keeps re-prompting until the user
              // has said no twice, and a disabled button made a first accidental
              // no look permanent.
              <Button
                size="300"
                radii="300"
                onClick={() => micPermission.request().then(() => loadDevices())}
                disabled={micPermission.requesting}
              >
                <Text size="B300">{micPermission.state === 'denied' ? 'Ask again' : 'Allow'}</Text>
              </Button>
            )
          }
        />
        {micPermission.error && (
          <Text style={{ color: color.Critical.Main }} size="T200">
            {micPermission.error}
          </Text>
        )}
      </SequenceCard>

      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Input device"
          description="Used for voice messages and calls. The system default follows whatever you plug in."
        >
          <Box direction="Column" gap="100" style={{ marginTop: config.space.S200 }}>
            {!labelled && (
              <Box direction="Column" gap="100">
                <Text size="T200" priority="300">
                  Device names are hidden until you allow microphone access once.
                </Text>
                <Box>
                  <Button
                    size="300"
                    radii="300"
                    variant="Secondary"
                    fill="Soft"
                    outlined
                    onClick={revealDevices}
                  >
                    <Text size="B300">Show devices</Text>
                  </Button>
                </Box>
              </Box>
            )}

            {labelled && (
              <Box direction="Column" gap="100">
                <Button
                  size="300"
                  radii="300"
                  variant={audioInputId === '' ? 'Primary' : 'Secondary'}
                  fill={audioInputId === '' ? 'Solid' : 'None'}
                  onClick={() => setAudioInputId('')}
                >
                  <Text size="B300">System default</Text>
                </Button>
                {devices.map((device) => (
                  <Button
                    key={device.deviceId}
                    size="300"
                    radii="300"
                    variant={audioInputId === device.deviceId ? 'Primary' : 'Secondary'}
                    fill={audioInputId === device.deviceId ? 'Solid' : 'None'}
                    onClick={() => setAudioInputId(device.deviceId)}
                  >
                    <Text size="B300" truncate>
                      {device.label || device.deviceId}
                    </Text>
                  </Button>
                ))}
              </Box>
            )}

            {error && (
              <Text size="T200" style={{ color: color.Critical.Main }}>
                {error}
              </Text>
            )}
          </Box>
        </SettingTile>
      </SequenceCard>

      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Echo cancellation"
          after={
            <Switch variant="Primary" value={echoCancellation} onChange={setEchoCancellation} />
          }
        />
        <SettingTile
          title="Noise suppression"
          description="Turn off when recording anything other than speech — it treats music as noise."
          after={
            <Switch variant="Primary" value={noiseSuppression} onChange={setNoiseSuppression} />
          }
        />
        <SettingTile
          title="Automatic gain control"
          after={<Switch variant="Primary" value={autoGainControl} onChange={setAutoGainControl} />}
        />
      </SequenceCard>
    </Box>
  );
}
