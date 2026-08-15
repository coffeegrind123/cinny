import { useRef } from 'react';
import { Scroll } from 'folds';

import {
  Sidebar,
  SidebarContent,
  SidebarStackSeparator,
  SidebarStack,
} from '../../components/sidebar';
import {
  DirectTab,
  DirectRailButtons,
  HomeTab,
  RoomsTab,
  SpaceTabs,
  InboxTab,
  ExploreTab,
  SettingsTab,
  UnverifiedTab,
  SearchTab,
} from './sidebar';
import { CreateTab } from './sidebar/CreateTab';
import { useShellLayout } from '../../hooks/useShellLayout';

export function SidebarNav() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const layout = useShellLayout();

  return (
    <Sidebar>
      <SidebarContent
        scrollable={
          <Scroll ref={scrollRef} variant="Background" size="0">
            <SidebarStack>
              <HomeTab />
              {layout.roomsPseudoSpace && <RoomsTab />}
              {layout.directTab && <DirectTab />}
            </SidebarStack>
            {layout.dmRailButtons && <DirectRailButtons />}
            <SpaceTabs scrollRef={scrollRef} />
            <SidebarStackSeparator />
            <SidebarStack>
              <ExploreTab />
              <CreateTab />
            </SidebarStack>
          </Scroll>
        }
        sticky={
          <>
            <SidebarStackSeparator />
            <SidebarStack>
              <SearchTab />
              <UnverifiedTab />
              {/* Both move into the top bar when there is one to move into. */}
              {!layout.topBar && <InboxTab />}
              {!layout.topBarProfile && <SettingsTab />}
            </SidebarStack>
          </>
        }
      />
    </Sidebar>
  );
}
