import React from 'react';
import { Box, Text, Button, Icon, Icons, IconButton, Spinner, color, toRem } from 'folds';
import { useUpdateCheck } from '../../hooks/useUpdateCheck';

export function UpdateBanner() {
  const { status, update, error, downloadAndInstall, checkForUpdate } = useUpdateCheck();

  if (status === 'idle' || status === 'checking' || status === 'no-update') {
    return null;
  }

  if (status === 'error') {
    return (
      <Box
        style={{
          backgroundColor: color.SurfaceVariant.Container,
          borderBottom: `1px solid ${color.Secondary.Container}`,
          padding: `${toRem(8)} ${toRem(16)}`,
        }}
        alignItems="Center"
        justifyContent="SpaceBetween"
        gap="200"
      >
        <Box grow="Yes" gap="100" alignItems="Center">
          <Icon src={Icons.Warning} size="200" />
          <Text size="T300">Update check failed: {error}</Text>
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
        style={{
          backgroundColor: color.SurfaceVariant.Container,
          borderBottom: `1px solid ${color.Secondary.Container}`,
          padding: `${toRem(8)} ${toRem(16)}`,
        }}
        alignItems="Center"
        justifyContent="SpaceBetween"
        gap="200"
      >
        <Box grow="Yes" gap="100" alignItems="Center">
          <Icon src={Icons.Info} size="200" />
          <Text size="T300">
            Cinny {update.version} available — tap to update
          </Text>
        </Box>
        <Button variant="Primary" size="300" onClick={downloadAndInstall}>
          <Text size="T300">Update</Text>
        </Button>
      </Box>
    );
  }

  if (status === 'downloading') {
    return (
      <Box
        style={{
          backgroundColor: color.SurfaceVariant.Container,
          borderBottom: `1px solid ${color.Secondary.Container}`,
          padding: `${toRem(8)} ${toRem(16)}`,
        }}
        alignItems="Center"
        gap="200"
      >
        <Spinner size="200" />
        <Text size="T300">Downloading update...</Text>
      </Box>
    );
  }

  return null;
}
