import { useCallback, useEffect, useRef } from 'react';
import { Spinner, Text } from 'folds';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { AsyncStatus, useAsyncCallback } from '../../../hooks/useAsyncCallback';
import { IAudioInfo } from '../../../../types/matrix/common';
import {
  decryptFile,
  downloadEncryptedMedia,
  downloadMedia,
  mxcUrlToHttp,
} from '../../../utils/matrix';
import { useMediaAuthentication } from '../../../hooks/useMediaAuthentication';

export type AudioContentProps = {
  mimeType: string;
  url: string;
  info: IAudioInfo;
  encInfo?: EncryptedAttachmentInfo;
};
export function AudioContent({ mimeType, url, encInfo }: AudioContentProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();

  // Encrypted attachments are ciphertext, and authenticated media needs an
  // Authorization header the bare <audio> element can't send — both must be
  // fetched to a blob URL first. Plain unauthenticated media streams natively.
  const needsBlob = !!encInfo || useAuthentication;
  const directUrl = needsBlob ? undefined : mxcUrlToHttp(mx, url, useAuthentication) ?? undefined;

  const [srcState, loadSrc] = useAsyncCallback<string, Error, []>(
    useCallback(async () => {
      const mediaUrl = mxcUrlToHttp(mx, url, useAuthentication);
      if (!mediaUrl) throw new Error('Invalid media URL');
      const fileContent = encInfo
        ? await downloadEncryptedMedia(mediaUrl, (encBuf) => decryptFile(encBuf, mimeType, encInfo))
        : await downloadMedia(mediaUrl);
      return URL.createObjectURL(fileContent);
    }, [mx, url, useAuthentication, mimeType, encInfo])
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
    []
  );

  if (needsBlob && srcState.status === AsyncStatus.Error) {
    return (
      <Text size="T200" priority="300">
        Failed to load audio.
      </Text>
    );
  }

  if (needsBlob && srcState.status !== AsyncStatus.Success) {
    return <Spinner variant="Secondary" size="400" />;
  }

  const src = needsBlob ? (srcState.status === AsyncStatus.Success ? srcState.data : undefined) : directUrl;

  return <audio style={{ width: '100%' }} controls preload="metadata" src={src} />;
}
