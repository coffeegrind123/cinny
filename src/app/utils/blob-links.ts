// Global click handler for blob: links — since the OS can't open
// blob: URLs, we intercept clicks and trigger a download instead.
export function initBlobLinkHandler(): () => void {
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a[href^="blob:"]') as HTMLAnchorElement | null;
    if (!anchor) return;

    e.preventDefault();
    e.stopPropagation();

    const href = anchor.getAttribute('href');
    if (!href) return;

    // Use a temporary anchor with download attribute to trigger save
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = href;
    downloadAnchor.download = anchor.download || anchor.textContent?.trim() || 'download';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}
