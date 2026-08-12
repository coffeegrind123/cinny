import { IContent } from 'matrix-js-sdk';

// A voice message is an ordinary `m.audio` carrying extra keys. The empty
// `org.matrix.msc3245.voice` object is the whole signal — its presence means
// "draw this as a voice note", not "this is a different kind of event". Older
// clients used `org.matrix.msc2516.voice` for the same thing, and messages sent
// with it are still in people's timelines, so both are accepted.
const VOICE_HINT_KEYS = ['org.matrix.msc3245.voice', 'org.matrix.msc2516.voice'] as const;

const AUDIO_BLOCK_KEY = 'org.matrix.msc1767.audio';

export type VoiceAudioBlock = {
  /** Milliseconds. */
  duration?: number;
  /** 0..1 per bucket, already scaled down from the wire's 0..1024. */
  waveform?: number[];
};

export const isVoiceMessageContent = (content: IContent): boolean =>
  VOICE_HINT_KEYS.some((key) => {
    const value = content[key];
    // Must be an object, but is expected to be empty — never test truthiness of
    // its contents.
    return typeof value === 'object' && value !== null;
  });

/**
 * Reads the MSC1767 audio block, tolerating everything senders get wrong:
 * missing block, waveform of the wrong length, values outside the documented
 * 0..1024 range, non-numeric entries.
 */
export const getVoiceAudioBlock = (content: IContent): VoiceAudioBlock => {
  const block = content[AUDIO_BLOCK_KEY];
  if (typeof block !== 'object' || block === null) return {};

  const { duration, waveform } = block as { duration?: unknown; waveform?: unknown };

  const parsedDuration =
    typeof duration === 'number' && Number.isFinite(duration) && duration >= 0
      ? duration
      : undefined;

  let parsedWaveform: number[] | undefined;
  if (Array.isArray(waveform) && waveform.length > 0) {
    const values = waveform
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      .map((v) => Math.min(1, Math.max(0, v / 1024)));
    if (values.length > 0) parsedWaveform = values;
  }

  return { duration: parsedDuration, waveform: parsedWaveform };
};
