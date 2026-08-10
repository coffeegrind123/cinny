// Node-globals shim for bundled dependencies that expect `global`.
//
// This used to be an inline <script> in index.html, which forced any
// Content-Security-Policy to weaken script-src with 'unsafe-inline'.
// Keeping it as a real file lets the shipped CSP use `script-src 'self'`.
// It must stay a classic (non-module) script loaded before the app entry so
// `global` exists before any deferred module executes.
window.global ||= window;
