import React from 'react';
import { Changelog } from '../../features/changelog/Changelog';

// Used to be a Cinny-logo + Source/Support buttons hero. Replaced with the
// changelog viewer so the empty-state screen always tells the user what's
// new since the last release. Source lives at cinny/CHANGELOG.md (baked
// in via Vite `?raw` import).
export function WelcomePage() {
  return <Changelog />;
}
