import { useMatch } from 'react-router-dom';
import { getRoomsCreatePath, getRoomsPath, getRoomsSearchPath } from '../../pages/pathUtils';

export const useRoomsSelected = (): boolean => {
  const roomsMatch = useMatch({
    path: getRoomsPath(),
    caseSensitive: true,
    end: false,
  });

  return !!roomsMatch;
};

export const useRoomsCreateSelected = (): boolean => {
  const match = useMatch({
    path: getRoomsCreatePath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};

export const useRoomsSearchSelected = (): boolean => {
  const match = useMatch({
    path: getRoomsSearchPath(),
    caseSensitive: true,
    end: false,
  });

  return !!match;
};
