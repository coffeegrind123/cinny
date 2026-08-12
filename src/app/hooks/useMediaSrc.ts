import { useCallback, useEffect, useRef } from 'react';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { useMatrixClient } from './useMatrixClient';
import { AsyncState, AsyncStatus, useAsyncCallback } from './useAsyncCallback';
import { decryptFile, downloadEncryptedMedia, downloadMedia, mxcUrlToHttp } from '../utils/matrix';
import { useMediaAuthentication } from './useMediaAuthentication';

export type MediaSrc = {
  /** Ready to hand to an <audio>/<video> element, or undefined while loading. */
  src?: string;
  /** State of the blob fetch. Always Idle when the media streams directly. */
  state: AsyncState<string, Error>;
  /** True when the media had to be fetched rather than streamed. */
  needsBlob: boolean;
};

/**
 * Resolves an mxc URL to something an HTML media element can actually play.
 *
 * Encrypted attachments are ciphertext, and authenticated media needs an
 * Authorization header a bare media element cannot send — both have to be
 * fetched into a blob URL first. Plain unauthenticated media streams natively,
 * which matters on long files: streaming starts playing immediately, while a
 * blob has to download in full first.
 *
 * Extracted from AudioContent so the voice-message player shares exactly this
 * behaviour rather than growing its own subtly different copy.
 */
export function useMediaSrc(
  url: string,
  mimeType: string,
  encInfo?: EncryptedAttachmentInfo,
): MediaSrc {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  const needsBlob = !!encInfo || useAuthentication;
  const directUrl = needsBlob ? undefined : (mxcUrlToHttp(mx, url, useAuthentication) ?? undefined);

  const [srcState, loadSrc] = useAsyncCallback<string, Error, []>(
    useCallback(async () => {
      const mediaUrl = mxcUrlToHttp(mx, url, useAuthentication);
      if (!mediaUrl) throw new Error('Invalid media URL');
      const fileContent = encInfo
        ? await downloadEncryptedMedia(mediaUrl, (encBuf) => decryptFile(encBuf, mimeType, encInfo))
        : await downloadMedia(mediaUrl);
      return URL.createObjectURL(fileContent);
    }, [mx, url, useAuthentication, mimeType, encInfo]),
  );

  useEffect(() => {
    if (needsBlob) loadSrc();
  }, [needsBlob, loadSrc]);

  // Release the object URL when the component unmounts.
  const blobRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (srcState.status === AsyncStatus.Success) blobRef.current = srcState.data;
  }, [srcState]);
  useEffect(
    () => () => {
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    },
    [],
  );

  const src = needsBlob
    ? srcState.status === AsyncStatus.Success
      ? srcState.data
      : undefined
    : directUrl;

  return { src, state: srcState, needsBlob };
}
