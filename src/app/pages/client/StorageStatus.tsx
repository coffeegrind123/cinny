import { Box, config, Line, Text } from 'folds';
import { useClientStorageError } from '../../../client/storageStatus';
import { ContainerColor } from '../../styles/ContainerColor.css';

export function StorageStatus() {
  const storageError = useClientStorageError();

  if (!storageError) return null;

  return (
    <Box direction="Column" shrink="No" role="alert">
      <Box
        className={ContainerColor({ variant: 'Critical' })}
        style={{ padding: `${config.space.S100} ${config.space.S300}` }}
        alignItems="Center"
        justifyContent="Center"
      >
        <Text size="L400" align="Center">
          Local storage failed. Free disk space, then reload Cinny. Do not send messages until this
          is fixed.
        </Text>
      </Box>
      <Line variant="Critical" size="300" />
    </Box>
  );
}
