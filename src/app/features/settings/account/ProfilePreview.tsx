import { Avatar, Box, Button, Text } from 'folds';
import { UserProfile } from '../../../hooks/useUserProfile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../../utils/matrix';
import { UserAvatar } from '../../../components/user-avatar';
import { nameInitials } from '../../../utils/common';
import { getProfileBiography, getProfilePronouns } from '../../../../types/matrix/profile';
import { useUserPresence } from '../../../hooks/useUserPresence';
import { useUserRichPresence } from '../../../hooks/useUserRichPresence';
import { UserRichPresence } from '../../../components/user-profile/UserRichPresence';
import * as css from './ProfilePreview.css';

type ProfilePreviewProps = {
  profile: UserProfile;
  bannerMxc?: string;
  userId: string;
  requestEdit: () => void;
};

export function ProfilePreview({ profile, bannerMxc, userId, requestEdit }: ProfilePreviewProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const displayName = profile.displayName ?? getMxIdLocalPart(userId) ?? userId;
  const avatarUrl = profile.avatarUrl
    ? mxcUrlToHttp(mx, profile.avatarUrl, useAuthentication, 128, 128, 'crop') ?? undefined
    : undefined;
  const bannerUrl = bannerMxc
    ? mxcUrlToHttp(mx, bannerMxc, useAuthentication) ?? undefined
    : undefined;
  const pronouns = getProfilePronouns(profile.extended)
    .map((pronoun) => pronoun.summary)
    .join(', ');
  const biography = getProfileBiography(profile.extended);
  const presence = useUserPresence(userId);
  const richPresence = useUserRichPresence(userId);

  return (
    <Box className={css.PreviewColumn} direction="Column" gap="200">
      <Text size="L400">Profile Preview</Text>
      <div className={css.ProfileCard}>
        {bannerUrl ? (
          <img className={css.Banner} src={bannerUrl} alt="" />
        ) : (
          <div className={css.Banner} />
        )}
        <Box className={css.CardBody} direction="Column" gap="300">
          <div className={css.AvatarWrap}>
            <Avatar size="500" radii="400">
              <UserAvatar
                userId={userId}
                src={avatarUrl}
                renderFallback={() => <Text size="H3">{nameInitials(displayName)}</Text>}
              />
            </Avatar>
          </div>
          <Box direction="Column" gap="0">
            <Box alignItems="Baseline" gap="200" wrap="Wrap">
              <Text size="H4">{displayName}</Text>
              {pronouns && (
                <Text size="T200" priority="300">
                  {pronouns}
                </Text>
              )}
            </Box>
            <Text size="T200" priority="300">
              {userId}
            </Text>
            {presence?.status && <Text size="T200">{presence.status}</Text>}
          </Box>
          {biography && (
            <Box direction="Column" gap="100">
              <Text size="L400">About Me</Text>
              <Text className={css.Biography} size="T300" priority="300">
                {biography}
              </Text>
            </Box>
          )}
          {richPresence && <UserRichPresence presence={richPresence} />}
          <Button variant="Primary" fill="Soft" radii="300" onClick={requestEdit}>
            <Text size="B300">Edit Profile</Text>
          </Button>
        </Box>
      </div>
    </Box>
  );
}
