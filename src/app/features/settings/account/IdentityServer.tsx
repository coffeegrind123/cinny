import { FormEventHandler, useCallback, useState } from 'react';
import { Box, Button, Input, Spinner, Text, color } from 'folds';
import { SequenceCard } from '../../../components/sequence-card';
import { SequenceCardStyle } from '../styles.css';
import { SettingTile } from '../../../components/setting-tile';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';

const IDENTITY_SERVER_ACCOUNT_DATA = 'm.identity_server';

/**
 * The identity server this account uses, if any.
 *
 * Worth being blunt in the UI about what one is for: an identity server maps
 * email addresses and phone numbers to Matrix IDs, so setting one means handing
 * a third party a hash of every address you look up or bind. Nothing here needs
 * it except finding people by email and being findable that way yourself, which
 * is why this ships empty and stays empty unless someone chooses otherwise.
 */
export function IdentityServer() {
  const mx = useMatrixClient();

  const current = mx.getIdentityServerUrl() ?? '';
  const [value, setValue] = useState(current);

  const [state, save] = useAsyncCallback<void, Error, [string]>(
    useCallback(
      async (url) => {
        const trimmed = url.trim().replace(/\/+$/, '');
        // Account data is the source of truth the sdk reads on the next start;
        // setting only the in-memory value would silently revert on reload.
        await mx.setAccountData(
          IDENTITY_SERVER_ACCOUNT_DATA as never,
          {
            base_url: trimmed === '' ? null : trimmed,
          } as never,
        );
        mx.setIdentityServerUrl(trimmed === '' ? undefined : trimmed);
      },
      [mx],
    ),
  );

  const handleSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
    evt.preventDefault();
    save(value);
  };

  const saving = state.status === AsyncStatus.Loading;

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Discovery</Text>
      <SequenceCard
        className={SequenceCardStyle}
        variant="SurfaceVariant"
        direction="Column"
        gap="400"
      >
        <SettingTile
          title="Identity Server"
          description="Optional. Lets you invite people by email and be found by yours. The server sees every address you look up, so leave this blank unless you need it."
        >
          <Box as="form" onSubmit={handleSubmit} gap="200" style={{ marginTop: '8px' }}>
            <Box grow="Yes">
              <Input
                value={value}
                onChange={(evt) => setValue(evt.currentTarget.value)}
                variant="Background"
                size="400"
                radii="300"
                placeholder="https://vector.im"
              />
            </Box>
            <Button
              type="submit"
              variant="Primary"
              size="400"
              radii="300"
              disabled={saving || value.trim() === current}
              before={saving ? <Spinner size="200" fill="Solid" variant="Primary" /> : undefined}
            >
              <Text size="B400">{value.trim() === '' ? 'Clear' : 'Save'}</Text>
            </Button>
          </Box>

          {state.status === AsyncStatus.Error && (
            <Text size="T200" style={{ color: color.Critical.Main }}>
              Could not save the identity server.
            </Text>
          )}
          {state.status === AsyncStatus.Success && (
            <Text size="T200" style={{ color: color.Success.Main }}>
              Saved.
            </Text>
          )}
        </SettingTile>
      </SequenceCard>
    </Box>
  );
}
