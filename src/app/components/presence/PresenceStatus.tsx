import { Box, color, Icon, Icons, IconSrc, Text } from 'folds';
import { RichPresence } from '../../../types/matrix/richPresence';

/** Which of the two wins the line when a user has both. */
export type PresenceStatusPrefer = 'status' | 'activity';

type PresenceStatusProps = {
  // Custom status (m.presence status_msg).
  status?: string;
  richPresence?: RichPresence;
  className?: string;
  /**
   * There is one line and two things that can fill it, so one of them has to
   * lose, and which one depends on what the list is for.
   *
   * `status` (default) keeps the thing the user chose to say and demotes the
   * activity to the icon in front of it — right for the member list, which is
   * a roster of people and reads as "here is who this is".
   *
   * `activity` drops the custom status while something is playing. A chat list
   * is scanned for what someone is doing right now, and a status message often
   * sits unchanged for weeks; the stale line winning over the live one is the
   * wrong answer there.
   */
  prefer?: PresenceStatusPrefer;
};

const richPresenceIcon = (rp: RichPresence): IconSrc =>
  rp.type === 'media' ? Icons.Headphone : Icons.Play;

const richPresenceLabel = (rp: RichPresence): string =>
  rp.type === 'media' ? `Listening to ${rp.track}` : `Playing ${rp.name}`;

/**
 * Secondary-line status slot: what someone is listening to or playing, or the
 * custom status they set, on the line under their name.
 *
 * Whichever of the two is not showing is dropped rather than wrapped onto a
 * second line — this is one line by design, in lists whose rows are scanned
 * rather than read. `prefer` decides which one that is.
 */
export function PresenceStatus({
  status,
  richPresence,
  className,
  prefer = 'status',
}: PresenceStatusProps) {
  let icon: IconSrc | undefined;
  let text: string | undefined;

  if (richPresence && (prefer === 'activity' || !status)) {
    text = richPresenceLabel(richPresence);
    icon = richPresenceIcon(richPresence);
  } else if (status) {
    text = status;
    // Still flagged when an activity is running and the status won the line:
    // the icon is the only thing left saying there IS one (Discord-style).
    icon = richPresence ? richPresenceIcon(richPresence) : undefined;
  }

  if (!text) return null;
  return (
    <Box as="span" className={className} alignItems="Center" gap="100" grow="Yes">
      {icon && (
        <Icon style={{ color: color.Success.Main, flexShrink: 0 }} src={icon} size="50" filled />
      )}
      <Text size="T200" priority="300" truncate title={text}>
        {text}
      </Text>
    </Box>
  );
}
