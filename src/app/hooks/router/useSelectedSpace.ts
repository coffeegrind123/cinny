import { useMatch, useParams } from 'react-router-dom';
import { getCanonicalAliasRoomId, isRoomAlias } from '../../utils/matrix';
import { useMatrixClient } from '../useMatrixClient';
import { SPACE_LOBBY_PATH, SPACE_SEARCH_PATH } from '../../pages/paths';

export const useSelectedSpace = (): string | undefined => {
  const mx = useMatrixClient();

  const { spaceIdOrAlias } = useParams();

  const spaceId =
    spaceIdOrAlias && isRoomAlias(spaceIdOrAlias)
      ? getCanonicalAliasRoomId(mx, spaceIdOrAlias)
      : spaceIdOrAlias;

  return spaceId;
};

export const useSpaceLobbySelected = (spaceIdOrAlias: string): boolean => {
  const match = useMatch({
    path: SPACE_LOBBY_PATH,
    caseSensitive: true,
    end: false,
  });

  return !!match && match.params.spaceIdOrAlias === spaceIdOrAlias;
};

export const useSpaceSearchSelected = (spaceIdOrAlias: string): boolean => {
  const match = useMatch({
    path: SPACE_SEARCH_PATH,
    caseSensitive: true,
    end: false,
  });

  return !!match && match.params.spaceIdOrAlias === spaceIdOrAlias;
};
