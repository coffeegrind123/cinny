import React from 'react';
import { Box, Text, Button, Icon, Icons, IconButton, Spinner, color, toRem } from 'folds';
import { useUpdateCheck } from '../../hooks/useUpdateCheck';
import { mobileOrTablet } from '../../utils/user-agent';

// "Tap" on a touch device, "Click" everywhere else. The instruction is only
// useful if it names the gesture the reader actually has — telling a desktop
// user to tap reads as a mobile app someone forgot to adapt.
//
// Read from the user agent rather than from a touch-capability query: a
// touchscreen laptop still has a pointer, and its owner clicks.
const pressVerb = (): string => (mobileOrTablet() ? 'tap' : 'click');

// Shared layout for every banner variant. `width: 100%` forces the Box
// to span the parent column (folds Boxes don't stretch their cross-axis
// without it on every platform — the user saw the banner ending after
// the text on mobile). `minHeight` is the size-300 Button height +
// vertical padding so the action button never spills out of the banner.
const containerStyle: React.CSSProperties = {
  backgroundColor: color.SurfaceVariant.Container,
  borderBottom: `1px solid ${color.Secondary.Container}`,
  padding: `${toRem(8)} ${toRem(16)}`,
  width: '100%',
  minHeight: toRem(48),
  flexShrink: 0,
  boxSizing: 'border-box',
};

export function UpdateBanner() {
  const { status, update, error, downloadAndInstall, checkForUpdate } = useUpdateCheck();

  if (status === 'idle' || status === 'checking' || status === 'no-update') {
    return null;
  }

  if (status === 'error') {
    return (
      <Box style={containerStyle} alignItems="Center" justifyContent="SpaceBetween" gap="200">
        {/* Invisible mirror of the action button. Without it the text is
            centred in the space *left of* the button rather than in the
            banner, which reads as slightly-off rather than centred. */}
        <Box shrink="No" aria-hidden style={{ visibility: 'hidden' }}>
          <IconButton size="300" variant="SurfaceVariant" tabIndex={-1}>
            <Icon src={Icons.Reload} />
          </IconButton>
        </Box>
        <Box
          grow="Yes"
          gap="100"
          alignItems="Center"
          justifyContent="Center"
          style={{ minWidth: 0 }}
        >
          <Icon src={Icons.Warning} size="200" />
          <Text size="T300" truncate>
            Update check failed: {error}
          </Text>
        </Box>
        <IconButton size="300" variant="SurfaceVariant" onClick={checkForUpdate}>
          <Icon src={Icons.Reload} />
        </IconButton>
      </Box>
    );
  }

  if (status === 'available' && update) {
    return (
      <Box style={containerStyle} alignItems="Center" justifyContent="SpaceBetween" gap="200">
        <Box shrink="No" aria-hidden style={{ visibility: 'hidden' }}>
          <Button variant="Primary" size="300" tabIndex={-1}>
            <Text size="T300">{update.version ? 'Update' : 'Reload'}</Text>
          </Button>
        </Box>
        <Box
          grow="Yes"
          gap="100"
          alignItems="Center"
          justifyContent="Center"
          style={{ minWidth: 0 }}
        >
          <Icon src={Icons.Info} size="200" />
          <Text size="T300" truncate>
            {update.version
              ? `Prinny ${update.version} available, ${pressVerb()} to update`
              : 'New version available — reload to apply'}
          </Text>
        </Box>
        <Button variant="Primary" size="300" onClick={downloadAndInstall}>
          <Text size="T300">{update.version ? 'Update' : 'Reload'}</Text>
        </Button>
      </Box>
    );
  }

  if (status === 'downloading') {
    return (
      <Box style={containerStyle} alignItems="Center" justifyContent="Center" gap="200">
        <Spinner size="200" />
        <Text size="T300">Downloading update...</Text>
      </Box>
    );
  }

  return null;
}
