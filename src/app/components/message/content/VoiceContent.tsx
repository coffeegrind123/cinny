import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, Icon, IconButton, Icons, Spinner, Text, config } from 'folds';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { AsyncStatus } from '../../../hooks/useAsyncCallback';
import { IAudioInfo } from '../../../../types/matrix/common';
import { useMediaSrc } from '../../../hooks/useMediaSrc';
import { Waveform } from '../../media';
import { millisecondsToMinutesAndSeconds } from '../../../utils/common';

const WAVEFORM_SAMPLES = 44;
const PLAYBACK_RATES = [1, 1.5, 2] as const;

/**
 * Decodes the clip and reduces it to `WAVEFORM_SAMPLES` peaks.
 *
 * Only used when the sender shipped no waveform of their own — clients that
 * send `m.audio` without the MSC1767 audio block (and every voice note we
 * ourselves sent before this existed) would otherwise draw as a flat line.
 */
const computeWaveform = async (src: string): Promise<number[]> => {
  const response = await fetch(src);
  const buffer = await response.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(buffer);
    const data = audio.getChannelData(0);
    const bucketSize = Math.floor(data.length / WAVEFORM_SAMPLES) || 1;
    const peaks: number[] = [];
    for (let i = 0; i < WAVEFORM_SAMPLES; i += 1) {
      let peak = 0;
      const from = i * bucketSize;
      const to = Math.min(from + bucketSize, data.length);
      for (let j = from; j < to; j += 1) {
        const value = Math.abs(data[j]);
        if (value > peak) peak = value;
      }
      peaks.push(peak);
    }
    // Normalise so a quietly recorded note still fills the strip.
    const max = Math.max(...peaks, 0.01);
    return peaks.map((p) => p / max);
  } finally {
    await ctx.close();
  }
};

export type VoiceContentProps = {
  mimeType: string;
  url: string;
  info: IAudioInfo;
  encInfo?: EncryptedAttachmentInfo;
  /** From `org.matrix.msc1767.audio.waveform`, already scaled to 0..1. */
  waveform?: number[];
  /** Milliseconds, from the audio block or `info.duration`. */
  duration?: number;
};

/**
 * Voice-message bubble: waveform, duration, play/pause, seek, speed.
 *
 * Falls back to sensible behaviour at every step — a missing waveform is
 * computed locally, a missing duration is read off the element once metadata
 * arrives, and an engine that reports `Infinity` for a streamed ogg (WebKit
 * does) still gets a working seek bar.
 */
export function VoiceContent({
  mimeType,
  url,
  info,
  encInfo,
  waveform,
  duration,
}: VoiceContentProps) {
  const { src, state, needsBlob } = useMediaSrc(url, mimeType, encInfo);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);
  const [computedWaveform, setComputedWaveform] = useState<number[]>();

  const durationMs = duration ?? info.duration;
  const [measuredDuration, setMeasuredDuration] = useState<number>();
  const totalSeconds = measuredDuration ?? (durationMs !== undefined ? durationMs / 1000 : 0);

  const senderWaveform = useMemo(() => {
    if (!waveform || waveform.length === 0) return undefined;
    return waveform;
  }, [waveform]);

  useEffect(() => {
    if (senderWaveform || !src) return;
    let alive = true;
    computeWaveform(src)
      .then((peaks) => {
        if (alive) setComputedWaveform(peaks);
      })
      .catch(() => {
        // A clip we cannot decode still plays through the element; a flat
        // strip is a fair rendering of "we don't know the shape".
        if (alive) setComputedWaveform(new Array(WAVEFORM_SAMPLES).fill(0.15));
      });
    return () => {
      alive = false;
    };
  }, [senderWaveform, src]);

  const bars = senderWaveform ?? computedWaveform ?? new Array(WAVEFORM_SAMPLES).fill(0.15);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, []);

  const handleSeek = useCallback(
    (ratio: number) => {
      const audio = audioRef.current;
      if (!audio || totalSeconds <= 0) return;
      audio.currentTime = ratio * totalSeconds;
      setCurrentTime(ratio * totalSeconds);
    },
    [totalSeconds],
  );

  const cycleRate = useCallback(() => {
    const next = (rateIndex + 1) % PLAYBACK_RATES.length;
    setRateIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = PLAYBACK_RATES[next];
  }, [rateIndex]);

  if (needsBlob && state.status === AsyncStatus.Error) {
    return (
      <Text size="T200" priority="300">
        Failed to load voice message.
      </Text>
    );
  }

  if (needsBlob && state.status !== AsyncStatus.Success) {
    return <Spinner variant="Secondary" size="400" />;
  }

  const progress = totalSeconds > 0 ? Math.min(1, currentTime / totalSeconds) : 0;
  const remainingMs = Math.max(0, (totalSeconds - currentTime) * 1000);

  return (
    <Box alignItems="Center" gap="200" style={{ padding: config.space.S100, minWidth: 0 }}>
      <Box shrink="No">
        <IconButton
          onClick={togglePlay}
          variant="Primary"
          size="300"
          radii="Pill"
          aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        >
          <Icon src={playing ? Icons.Pause : Icons.Play} size="100" />
        </IconButton>
      </Box>

      <Box grow="Yes" style={{ minWidth: 0 }}>
        <Waveform waveform={bars} progress={progress} onSeek={handleSeek} />
      </Box>

      <Box shrink="No" alignItems="Center" gap="100">
        <Text size="T200" priority="300">
          {millisecondsToMinutesAndSeconds(
            playing || currentTime > 0 ? remainingMs : totalSeconds * 1000,
          )}
        </Text>
        {playing && (
          <Chip
            variant="SurfaceVariant"
            radii="Pill"
            size="400"
            onClick={cycleRate}
            aria-label="Playback speed"
          >
            <Text size="L400">{`${PLAYBACK_RATES[rateIndex]}x`}</Text>
          </Chip>
        )}
      </Box>

      { }
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onLoadedMetadata={(evt) => {
          const { duration: elDuration } = evt.currentTarget;
          // Streamed ogg reports Infinity in WebKit until it has been played
          // through; only trust a finite number.
          if (Number.isFinite(elDuration) && elDuration > 0) setMeasuredDuration(elDuration);
        }}
        onTimeUpdate={(evt) => setCurrentTime(evt.currentTarget.currentTime)}
        style={{ display: 'none' }}
      />
    </Box>
  );
}
