import { IMatrixProfile, IResultContext, Room } from 'matrix-js-sdk';
import { getMemberAvatarMxc, getMemberDisplayName } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';

/**
 * Sender profile as captured when the event was sent. Only present when the
 * request asked for `include_profile`, and the only source we have for members
 * who have since left the room.
 */
export const getResultProfile = (
  context: IResultContext | undefined,
  userId: string,
): IMatrixProfile | undefined => context?.profile_info?.[userId];

export const getResultDisplayName = (
  room: Room,
  userId: string,
  profile: IMatrixProfile | undefined,
): string =>
  getMemberDisplayName(room, userId) ?? profile?.displayname ?? getMxIdLocalPart(userId) ?? userId;

export const getResultAvatarMxc = (
  room: Room,
  userId: string,
  profile: IMatrixProfile | undefined,
): string | undefined => getMemberAvatarMxc(room, userId) ?? profile?.avatar_url;
