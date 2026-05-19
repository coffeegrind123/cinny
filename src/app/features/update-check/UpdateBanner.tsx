import React from 'react';
import { Box, Text, Button, Icon, Icons, IconButton, Spinner, color, toRem } from 'folds';
import { useUpdateCheck } from '../../hooks/useUpdateCheck';

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
      <Box
        style={containerStyle}
        alignItems="Center"
        justifyContent="SpaceBetween"
        gap="200"
      >
        <Box grow="Yes" gap="100" alignItems="Center" style={{ minWidth: 0 }}>
          <Icon src={Icons.Warning} size="200" />
          <Text size="T300" truncate>Update check failed: {error}</Text>
        </Box>
        <IconButton size="300" variant="SurfaceVariant" onClick={checkForUpdate}>
          <Icon src={Icons.Reload} />
        </IconButton>
      </Box>
    );
  }

  if (status === 'available' && update) {
    return (
      <Box
        style={containerStyle}
        alignItems="Center"
        justifyContent="SpaceBetween"
        gap="200"
      >
        <Box grow="Yes" gap="100" alignItems="Center" style={{ minWidth: 0 }}>
          <Icon src={Icons.Info} size="200" />
          <Text size="T300" truncate>
            {update.version
              ? `Cinny ${update.version} available — tap to update`
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
      <Box style={containerStyle} alignItems="Center" gap="200">
        <Spinner size="200" />
        <Text size="T300">Downloading update...</Text>
      </Box>
    );
  }

  return null;
}
