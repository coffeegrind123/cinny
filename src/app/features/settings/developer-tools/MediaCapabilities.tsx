import { useCallback, useState } from 'react';
import { Box, Text, Button, Spinner, color } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { copyToClipboard } from '../../../utils/dom';
import {
  ProbeResult,
  formatProbeReport,
  probeCodecs,
  probeDevices,
  probeDisplayMedia,
  probeEnvironment,
  probeMicrophone,
} from '../../../utils/media-capabilities';

type Section = [string, ProbeResult[]];

function ResultRow({ result }: { result: ProbeResult }) {
  const tone =
    result.ok === undefined ? undefined : result.ok ? color.Success.Main : color.Critical.Main;

  return (
    <Box gap="200" alignItems="Start">
      <Box shrink="No" style={{ minWidth: '40%' }}>
        <Text size="T200" priority="300">
          {result.label}
        </Text>
      </Box>
      <Box grow="Yes">
        <Text size="T200" style={tone ? { color: tone } : undefined}>
          {result.value}
        </Text>
      </Box>
    </Box>
  );
}

export function MediaCapabilities() {
  const [sections, setSections] = useState<Section[]>([]);
  const [running, setRunning] = useState(false);

  const runBaseProbes = useCallback(async () => {
    setRunning(true);
    try {
      const mic = await probeMicrophone();
      // Device labels only appear after a capture grant, so enumerate *after*
      // the mic probe — the other order reports "0/4 populated" every time and
      // makes it look like the engine is hiding devices.
      const devices = await probeDevices();
      setSections([
        ['Environment', probeEnvironment()],
        ['Microphone', mic],
        ['Devices', devices],
        ['MediaRecorder codecs', probeCodecs()],
      ]);
    } finally {
      setRunning(false);
    }
  }, []);

  const runDisplayProbe = useCallback(async () => {
    setRunning(true);
    try {
      const display = await probeDisplayMedia();
      setSections((prev) => [
        ...prev.filter(([t]) => t !== 'Screen capture'),
        ['Screen capture', display],
      ]);
    } finally {
      setRunning(false);
    }
  }, []);

  const runDownloadProbe = useCallback(() => {
    const stamp = new Date().toISOString();
    const blob = new Blob([`prinny download probe ${stamp}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'prinny-download-probe.txt';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Give the shell a moment to consume the URL before revoking it — Android's
    // WebView hands the blob to DownloadManager asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setSections((prev) => [
      ...prev.filter(([t]) => t !== 'Download'),
      [
        'Download',
        [
          {
            label: 'Blob download triggered',
            value: 'Check where (or whether) prinny-download-probe.txt was saved.',
          },
        ],
      ],
    ]);
  }, []);

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Media Capabilities</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Probe capture support"
          description="Asks for the microphone, then reports what this WebView actually granted. Release is immediate — nothing is recorded or sent."
          after={
            <Button
              onClick={runBaseProbes}
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              disabled={running}
              outlined
              before={running ? <Spinner variant="Secondary" size="100" /> : undefined}
            >
              <Text size="B300">Run</Text>
            </Button>
          }
        />
        <SettingTile
          title="Probe screen capture"
          description="Prompts for a screen or window. Meaningless on Android; run it on desktop builds."
          after={
            <Button
              onClick={runDisplayProbe}
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              disabled={running}
              outlined
            >
              <Text size="B300">Run</Text>
            </Button>
          }
        />
        <SettingTile
          title="Probe file download"
          description="Saves a one-line text file through the same path chat export will use."
          after={
            <Button
              onClick={runDownloadProbe}
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              outlined
            >
              <Text size="B300">Run</Text>
            </Button>
          }
        />
      </SequenceCard>

      {sections.length > 0 && (
        <SequenceCard
          className={SequenceCardStyle}
          variant="SurfaceVariant"
          direction="Column"
          gap="400"
        >
          {sections.map(([title, results]) => (
            <Box key={title} direction="Column" gap="200">
              <Text size="L400">{title}</Text>
              {results.map((result) => (
                <ResultRow key={`${title}-${result.label}`} result={result} />
              ))}
            </Box>
          ))}
          <Box>
            <Button
              onClick={() => copyToClipboard(formatProbeReport(sections))}
              variant="Secondary"
              fill="Soft"
              size="300"
              radii="300"
              outlined
            >
              <Text size="B300">Copy report</Text>
            </Button>
          </Box>
        </SequenceCard>
      )}
    </Box>
  );
}
