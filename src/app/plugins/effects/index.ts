import { EffectName } from './particles';

export * from './particles';

/**
 * Message types that carry an effect, and the emoji that trigger one.
 *
 * These strings are Element's, verbatim — including the fact that the first two
 * are `nic.custom.*` and the rest `io.element.effect*`. They look like a
 * mistake and are not ours to tidy: they are what is already on the wire, and
 * changing them would mean our confetti does nothing for anybody on Element and
 * theirs does nothing for us.
 */
export const EFFECT_MSG_TYPES: Record<EffectName, string> = {
  confetti: 'nic.custom.confetti',
  fireworks: 'nic.custom.fireworks',
  rainfall: 'io.element.effect.rainfall',
  snowfall: 'io.element.effect.snowfall',
  hearts: 'io.element.effect.hearts',
};

export const EFFECT_EMOJIS: Record<EffectName, string[]> = {
  confetti: ['🎊', '🎉'],
  fireworks: ['🎆'],
  rainfall: ['🌧️', '⛈️', '🌦️'],
  snowfall: ['❄', '🌨'],
  hearts: ['💝'],
};

const MSG_TYPE_TO_EFFECT: Record<string, EffectName> = Object.fromEntries(
  Object.entries(EFFECT_MSG_TYPES).map(([name, msgType]) => [msgType, name as EffectName]),
);

export const effectForMsgType = (msgType: string | undefined): EffectName | undefined =>
  msgType ? MSG_TYPE_TO_EFFECT[msgType] : undefined;

/**
 * The effect a message body triggers by containing its emoji, if any.
 *
 * Element fires effects on emoji as well as on msgtype, so a "🎉" from any
 * client sets off confetti for people who have effects on.
 */
export const effectForBody = (body: string | undefined): EffectName | undefined => {
  if (!body) return undefined;
  const found = (Object.entries(EFFECT_EMOJIS) as [EffectName, string[]][]).find(([, emojis]) =>
    emojis.some((emoji) => body.includes(emoji)),
  );
  return found?.[0];
};
