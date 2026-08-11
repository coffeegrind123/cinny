import { Component, ErrorInfo, ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
  /** Rendered in place of `children` once a descendant throws. */
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Render `fallback` instead of `children` when a descendant throws during
 * render, in a lifecycle method, or in a constructor.
 *
 * Replaces the `react-error-boundary` package. That package also offers
 * `FallbackComponent`, `fallbackRender`, `onError`, `onReset`, `resetKeys` and
 * a `useErrorBoundary` hook — none of which this project used. Both call sites
 * (TextViewer and the custom HTML parser's code block) pass a plain `fallback`
 * element and never reset, so this covers them exactly. Add the reset machinery
 * back only alongside a caller that needs it; getting `resetKeys` subtly wrong
 * is how a boundary starts swallowing recoveries.
 *
 * This has to be a class: `getDerivedStateFromError` and `componentDidCatch`
 * have no hook equivalent.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // React only surfaces caught errors in development, so log explicitly:
    // both call sites render user-supplied content (a code block, a text file),
    // and a silently swallowed failure there is indistinguishable from the
    // syntax highlighter simply having nothing to do.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo.componentStack);
  }

  render(): ReactNode {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    return hasError ? fallback : children;
  }
}
