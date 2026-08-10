import { ReactNode, useCallback, useMemo } from 'react';
import { Capabilities, validateAuthMetadata, ValidatedAuthMetadata } from 'matrix-js-sdk';
import { AsyncStatus, useAsyncCallbackValue } from '../hooks/useAsyncCallback';
import { useMatrixClient } from '../hooks/useMatrixClient';
import { MediaConfig } from '../hooks/useMediaConfig';
import { promiseFulfilledResult } from '../utils/common';
import { isWebUrl } from '../utils/safeUrl';

export type ServerConfigs = {
  capabilities?: Capabilities;
  mediaConfig?: MediaConfig;
  authMetadata?: ValidatedAuthMetadata;
};

type ServerConfigsLoaderProps = {
  children: (configs: ServerConfigs) => ReactNode;
};
export function ServerConfigsLoader({ children }: ServerConfigsLoaderProps) {
  const mx = useMatrixClient();
  const fallbackConfigs = useMemo(() => ({}), []);

  const [configsState] = useAsyncCallbackValue<ServerConfigs, unknown>(
    useCallback(async () => {
      const result = await Promise.allSettled([
        mx.getCapabilities(),
        mx.getMediaConfig(),
        mx.getAuthMetadata(),
      ]);

      const capabilities = promiseFulfilledResult(result[0]);
      const mediaConfig = promiseFulfilledResult(result[1]);
      const authMetadata = promiseFulfilledResult(result[2]);
      let validatedAuthMetadata: ValidatedAuthMetadata | undefined;

      try {
        validatedAuthMetadata = validateAuthMetadata(authMetadata);

        // `validateAuthMetadata` checks the OIDC document's shape, not the
        // scheme of the URLs inside it. `account_management_uri` and `issuer`
        // are chosen by the homeserver and are later handed to `window.open()`
        // by the device-management and cross-signing screens; in the Tauri shell
        // that reaches the OS URL opener, so a non-web scheme would invoke a
        // local protocol handler. Drop anything that is not an absolute http(s)
        // URL here, once, rather than at each of the three call sites.
        if (validatedAuthMetadata) {
          if (!isWebUrl(validatedAuthMetadata.account_management_uri)) {
            validatedAuthMetadata = {
              ...validatedAuthMetadata,
              account_management_uri: undefined,
            };
          }
          if (!isWebUrl(validatedAuthMetadata.issuer)) {
            console.error('Discarding auth metadata: issuer is not an http(s) URL');
            validatedAuthMetadata = undefined;
          }
        }
      } catch (e) {
        console.error(e);
      }

      return {
        capabilities,
        mediaConfig,
        authMetadata: validatedAuthMetadata,
      };
    }, [mx])
  );

  const configs: ServerConfigs =
    configsState.status === AsyncStatus.Success ? configsState.data : fallbackConfigs;

  return children(configs);
}
