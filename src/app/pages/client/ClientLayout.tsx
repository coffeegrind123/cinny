import React, { ReactNode } from 'react';
import { Box } from 'folds';
import { UpdateBanner } from '../../features/update-check/UpdateBanner';

type ClientLayoutProps = {
  nav: ReactNode;
  children: ReactNode;
};
export function ClientLayout({ nav, children }: ClientLayoutProps) {
  return (
    <Box grow="Yes" direction="Column">
      <UpdateBanner />
      <Box grow="Yes" direction="Row">
        <Box shrink="No">{nav}</Box>
        <Box grow="Yes">{children}</Box>
      </Box>
    </Box>
  );
}
