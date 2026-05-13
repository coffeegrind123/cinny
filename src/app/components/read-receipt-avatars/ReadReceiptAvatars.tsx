import React from 'react';
import { Box, Text, toRem } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';

type ReadReceiptAvatarsProps = {
  room: Room;
  userIds: string[];
  maxVisible?: number;
};

export function ReadReceiptAvatars({ room, userIds, maxVisible = 3 }: ReadReceiptAvatarsProps) {
  const mx = useMatrixClient();
  const useAuth = useMediaAuthentication();

  if (userIds.length === 0) return null;

  const visible = userIds.slice(0, maxVisible);
  const overflow = userIds.length - maxVisible;

  return (
    <Box gap="100" alignItems="Center" shrink="No">
      {visible.map((userId, i) => {
        const name = getMemberDisplayName(room, userId) ?? getMxIdLocalPart(userId) ?? userId;
        const member = room.getMember(userId);
        const avatarUrl = member?.getMxcAvatarUrl()
          ? mxcUrlToHttp(mx, member.getMxcAvatarUrl()!, useAuth, 24, 24, 'crop') ?? undefined
          : undefined;

        return (
          <Box
            key={userId}
            as="span"
            style={{
              width: toRem(16),
              height: toRem(16),
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: avatarUrl ? 'transparent' : 'var(--folds-color-surface-variant)',
              marginLeft: i > 0 ? toRem(-4) : 0,
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: toRem(8),
              lineHeight: 1,
            }}
            title={name}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Text size="T100">{name[0]?.toUpperCase()}</Text>
            )}
          </Box>
        );
      })}
      {overflow > 0 && (
        <Text size="T100" style={{ marginLeft: toRem(-2) }}>
          +{overflow}
        </Text>
      )}
    </Box>
  );
}
