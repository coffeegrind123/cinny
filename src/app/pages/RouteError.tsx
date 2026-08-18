import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { Box, Button, Dialog, Text, config, toRem } from 'folds';
import { SplashScreen } from '../components/splash-screen';
import { clearLoginData } from '../../client/initMatrix';

/**
 * What react-router renders when anything in the route tree throws.
 *
 * Without an `errorElement` the router falls back to its own built-in page —
 * "Unexpected Application Error!", a minified stack, and a note addressed to
 * the developer — which is what a user saw the day a hook read a context that
 * was not mounted yet. That page offers nothing to do about it: no reload, no
 * way out of a state that reproduces on every launch, and no clue that the
 * app is even Prinny.
 *
 * This is deliberately dependency-free of the Matrix client. It has to render
 * when the client failed to start, when a provider is missing, and when the
 * thrower is the thing that would normally supply the client — so it uses only
 * `clearLoginData`, which works with no client at all.
 */
export function RouteError() {
  const error = useRouteError();

  // React only surfaces this in development, and the router swallows it in
  // production; without an explicit log the stack is gone the moment this
  // renders, which is exactly when it is needed.
  console.error('Route error:', error);

  let message: string;
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'Unknown error';
  }

  const stack = error instanceof Error ? error.stack : undefined;

  return (
    <SplashScreen>
      <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="400">
        <Dialog>
          <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
            <Box direction="Column" gap="100">
              <Text size="H4">Something went wrong</Text>
              <Text size="T300" priority="400">
                Prinny hit an error it could not recover from. Reloading fixes most of these.
              </Text>
            </Box>

            <Text size="T200" priority="300">
              {message}
            </Text>

            {stack && (
              <details>
                <summary>
                  <Text as="span" size="T200" priority="300">
                    Technical details
                  </Text>
                </summary>
                <Box
                  style={{
                    marginTop: config.space.S200,
                    maxHeight: toRem(200),
                    overflow: 'auto',
                  }}
                >
                  <Text as="pre" size="T200" priority="300" style={{ whiteSpace: 'pre-wrap' }}>
                    {stack}
                  </Text>
                </Box>
              </details>
            )}

            <Button variant="Primary" onClick={() => window.location.reload()}>
              <Text as="span" size="B400">
                Reload
              </Text>
            </Button>
            {/* Last resort, and labelled as one: this deletes every local
                database and signs the session out, which is the only lever
                left when the failure reproduces on every launch — but it also
                loses the local cache and any unsent state, so it must never
                be the button someone presses first. */}
            <Button variant="Critical" fill="Soft" onClick={() => clearLoginData()}>
              <Text as="span" size="B400">
                Reset app data and sign out
              </Text>
            </Button>
          </Box>
        </Dialog>
      </Box>
    </SplashScreen>
  );
}
