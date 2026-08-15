import { useMemo } from 'react';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';

export type ShellLayout = {
  /** Orphan rooms live on their own `/rooms` page reached from the space rail. */
  roomsPseudoSpace: boolean;
  /** The Home nav lists orphan rooms. */
  roomsInHome: boolean;
  /** The Home nav lists direct messages. */
  directsInHome: boolean;
  /** Direct Messages keep their own entry in the client rail. */
  directTab: boolean;
  /** Unread direct messages appear as avatar buttons in the client rail. */
  dmRailButtons: boolean;
  /** A full-width bar sits above the sidebar. */
  topBar: boolean;
  /** That bar carries the profile and the settings button. */
  topBarProfile: boolean;
};

/**
 * Resolves the four shell settings into the questions the shell actually asks.
 *
 * The settings are written as independent switches, but two of them describe
 * the same slot from opposite ends, so a raw reading of the pair has a hole in
 * it: `roomsPseudoSpace` moves orphan rooms out of Home, and with
 * `unifiedHomeSidebar` off there would then be nothing left in Home at all.
 * Moving the rooms out therefore hands the Home slot to the direct messages —
 * the same end state the fork arrived at, and the only one where every list is
 * reachable. `unifiedHomeSidebar` on its own still means what it says: rooms
 * and DMs share the one nav.
 *
 * `topBarProfile` follows `topBar` for the plain reason that there is no bar to
 * put a profile in otherwise.
 */
export const useShellLayout = (): ShellLayout => {
  const [unifiedHomeSidebar] = useSetting(settingsAtom, 'unifiedHomeSidebar');
  const [roomsPseudoSpace] = useSetting(settingsAtom, 'roomsPseudoSpace');
  const [dmRailButtons] = useSetting(settingsAtom, 'dmRailButtons');
  const [topBar] = useSetting(settingsAtom, 'topBar');
  const [topBarProfile] = useSetting(settingsAtom, 'topBarProfile');

  return useMemo(() => {
    const directsInHome = unifiedHomeSidebar || roomsPseudoSpace;

    return {
      roomsPseudoSpace,
      roomsInHome: !roomsPseudoSpace,
      directsInHome,
      directTab: !directsInHome,
      dmRailButtons,
      topBar,
      topBarProfile: topBar && topBarProfile,
    };
  }, [unifiedHomeSidebar, roomsPseudoSpace, dmRailButtons, topBar, topBarProfile]);
};
