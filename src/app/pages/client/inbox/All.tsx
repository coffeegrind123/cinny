import { Box, Text } from 'folds';
import { useAtomValue } from 'jotai';
import { Notifications } from './Notifications';
import { InvitesContent } from './Invites';
import { allInvitesAtom } from '../../../state/room-list/inviteList';

/**
 * The whole inbox on one page: invites first, then notifications.
 *
 * Built as the notifications page with the invites handed to its `before` slot,
 * rather than as a page that renders both. The notification list is virtualised
 * against its own scroll element, so it has to BE the scroller — nesting it
 * inside another one leaves the virtualiser measuring a viewport that never
 * moves, and it renders the first screenful and then stops. Feeding invites into
 * that same scroller is the arrangement that keeps one scrollbar and a working
 * list.
 *
 * Invites come first because they are few, actionable, and expire in the sense
 * that matters — someone is waiting on an answer — whereas notifications are a
 * log you read back through.
 */
export function InboxAll() {
  const inviteCount = useAtomValue(allInvitesAtom).length;

  return (
    <Notifications
      title="All"
      before={
        // Hidden entirely when there are none, rather than shown with an empty
        // state: this is the top of a page whose main content is below it, and
        // "No Invites" would push the notifications down to say nothing. The
        // dedicated Invites page is where an empty state belongs.
        inviteCount > 0 ? (
          <Box direction="Column" gap="300">
            {/*
              The sections below are headed "Primary", "Public" and "Spam",
              which name themselves on the Invites page because the page is
              called Invites. Here they need saying what they are of.
            */}
            <Text size="H4">Invites</Text>
            <InvitesContent showFilters={false} />
          </Box>
        ) : null
      }
    />
  );
}
