import { useEffect, useRef, useState } from 'react';
import { Box, Spinner, Text, config } from 'folds';
import { AuthType } from 'matrix-js-sdk';

import { StageComponentProps } from './types';

/**
 * hCaptcha widget for the `m.login.recaptcha` stage.
 *
 * Synapse's `recaptcha_siteverify_api` is configurable and hCaptcha publishes a
 * drop-in-compatible siteverify endpoint, so a server can run hCaptcha while
 * still advertising the spec's `m.login.recaptcha` stage. The stage then hands
 * out an hCaptcha sitekey. Rendering Google's widget with it simply fails, and
 * that is not hypothetical — joinmatrix.org records it for catgirl.cloud
 * ("Uses hCaptcha."), and privacydev.net tracks hCaptcha as its own column.
 *
 * Loaded from hCaptcha's CDN on demand rather than bundled: the script is only
 * ever needed by the minority of servers that use it, and it must come from
 * their origin to work at all.
 */

const HCAPTCHA_SCRIPT_ID = 'hcaptcha-api-script';
const HCAPTCHA_SRC = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=__onHCaptchaLoad';

type HCaptchaApi = {
  render: (
    container: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; 'error-callback'?: () => void },
  ) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
    __onHCaptchaLoad?: () => void;
  }
}

/** Resolves once window.hcaptcha is usable. Shared across mounts. */
let loaderPromise: Promise<void> | undefined;

function loadHCaptcha(): Promise<void> {
  if (window.hcaptcha) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    // The API calls the global named in `onload`; a plain script.onload can
    // fire before hcaptcha finishes installing itself on window.
    window.__onHCaptchaLoad = () => resolve();

    const existing = document.getElementById(HCAPTCHA_SCRIPT_ID);
    if (existing) return;

    const script = document.createElement('script');
    script.id = HCAPTCHA_SCRIPT_ID;
    script.src = HCAPTCHA_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loaderPromise = undefined;
      reject(new Error('Failed to load hCaptcha'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function HCaptchaWidget({
  publicKey,
  session,
  submitAuthDict,
}: {
  publicKey: string;
  session: string;
} & Pick<StageComponentProps, 'submitAuthDict'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadHCaptcha()
      .then(() => {
        if (cancelled || renderedRef.current) return;
        const container = containerRef.current;
        if (!container || !window.hcaptcha) return;
        renderedRef.current = true;
        setLoading(false);
        window.hcaptcha.render(container, {
          sitekey: publicKey,
          callback: (token: string) => {
            submitAuthDict({
              type: AuthType.Recaptcha,
              response: token,
              session,
            });
          },
          'error-callback': () => setError('The captcha failed to verify. Please try again.'),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError('Could not load the captcha. Check your connection or any content blocker.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey, session, submitAuthDict]);

  return (
    <Box direction="Column" gap="200" alignItems="Center">
      {loading && <Spinner variant="Secondary" size="400" />}
      <div ref={containerRef} style={{ minHeight: loading ? 0 : 78 }} />
      {error && (
        <Text size="T200" style={{ padding: config.space.S100 }}>
          {error}
        </Text>
      )}
    </Box>
  );
}
