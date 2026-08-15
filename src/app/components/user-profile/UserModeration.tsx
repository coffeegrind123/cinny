import { Box, config, Text } from 'folds';
import { CutoutCard } from '../cutout-card';
import { SettingTile } from '../setting-tile';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { timeDayMonYear, timeHourMinute } from '../../utils/time';

type UserKickAlertProps = {
  reason?: string;
  kickedBy?: string;
  ts?: number;
};
export function UserKickAlert({ reason, kickedBy, ts }: UserKickAlertProps) {
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');

  const time = ts ? timeHourMinute(ts, hour24Clock) : undefined;
  const date = ts ? timeDayMonYear(ts, dateFormatString) : undefined;

  return (
    <CutoutCard style={{ padding: config.space.S200 }} variant="Critical">
      <SettingTile>
        <Box direction="Column" gap="200">
          <Box gap="200" justifyContent="SpaceBetween">
            <Text size="L400">Kicked User</Text>
            {time && date && (
              <Text size="T200">
                {date} {time}
              </Text>
            )}
          </Box>
          <Box direction="Column">
            {kickedBy && (
              <Text size="T200">
                Kicked by: <b>{kickedBy}</b>
              </Text>
            )}
            <Text size="T200">
              {reason ? (
                <>
                  Reason: <b>{reason}</b>
                </>
              ) : (
                <i>No Reason Provided.</i>
              )}
            </Text>
          </Box>
        </Box>
      </SettingTile>
    </CutoutCard>
  );
}

type UserBanAlertProps = {
  reason?: string;
  bannedBy?: string;
  ts?: number;
};
export function UserBanAlert({ reason, bannedBy, ts }: UserBanAlertProps) {
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');

  const time = ts ? timeHourMinute(ts, hour24Clock) : undefined;
  const date = ts ? timeDayMonYear(ts, dateFormatString) : undefined;

  return (
    <CutoutCard style={{ padding: config.space.S200 }} variant="Critical">
      <SettingTile>
        <Box direction="Column" gap="200">
          <Box gap="200" justifyContent="SpaceBetween">
            <Text size="L400">Banned User</Text>
            {time && date && (
              <Text size="T200">
                {date} {time}
              </Text>
            )}
          </Box>
          <Box direction="Column">
            {bannedBy && (
              <Text size="T200">
                Banned by: <b>{bannedBy}</b>
              </Text>
            )}
            <Text size="T200">
              {reason ? (
                <>
                  Reason: <b>{reason}</b>
                </>
              ) : (
                <i>No Reason Provided.</i>
              )}
            </Text>
          </Box>
        </Box>
      </SettingTile>
    </CutoutCard>
  );
}

type UserInviteAlertProps = {
  reason?: string;
  invitedBy?: string;
  ts?: number;
};
export function UserInviteAlert({ reason, invitedBy, ts }: UserInviteAlertProps) {
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');

  const time = ts ? timeHourMinute(ts, hour24Clock) : undefined;
  const date = ts ? timeDayMonYear(ts, dateFormatString) : undefined;

  return (
    <CutoutCard style={{ padding: config.space.S200 }} variant="Success">
      <SettingTile>
        <Box direction="Column" gap="200">
          <Box gap="200" justifyContent="SpaceBetween">
            <Text size="L400">Invited User</Text>
            {time && date && (
              <Text size="T200">
                {date} {time}
              </Text>
            )}
          </Box>
          <Box direction="Column">
            {invitedBy && (
              <Text size="T200">
                Invited by: <b>{invitedBy}</b>
              </Text>
            )}
            <Text size="T200">
              {reason ? (
                <>
                  Reason: <b>{reason}</b>
                </>
              ) : (
                <i>No Reason Provided.</i>
              )}
            </Text>
          </Box>
        </Box>
      </SettingTile>
    </CutoutCard>
  );
}
