import { CSSProperties, ReactNode } from 'react';
import { Box, Chip, Icon, Icons, Text, toRem } from 'folds';
import { IContent } from 'matrix-js-sdk';
import { isJumboEmoji, URL_REG } from '../../utils/regex';
import { trimReplyFromBody } from '../../utils/room';
import { MessageTextBody } from './layout';
import {
  MessageBadEncryptedContent,
  MessageBrokenContent,
  MessageDeletedContent,
  MessageEditedContent,
  MessageUnsupportedContent,
} from './content';
import {
  IAudioContent,
  IAudioInfo,
  IEncryptedFile,
  IFileContent,
  IFileInfo,
  IImageContent,
  IImageInfo,
  IThumbnailContent,
  IVideoContent,
  IVideoInfo,
  MATRIX_GIF_PROPERTY_NAME,
  MATRIX_SPOILER_PROPERTY_NAME,
  MATRIX_SPOILER_REASON_PROPERTY_NAME,
} from '../../../types/matrix/common';
import {
  FALLBACK_MIMETYPE,
  getBlobSafeMimeType,
  getImageSafeMimeType,
} from '../../utils/mimeTypes';
import { fitWithin, parseGeoUri, scaleYDimension } from '../../utils/common';
import { Attachment, AttachmentBox, AttachmentContent, AttachmentHeader } from './attachment';
import { FileHeader, FileDownloadButton } from './FileHeader';

export function MBadEncrypted() {
  return (
    <Text>
      <MessageBadEncryptedContent />
    </Text>
  );
}

type RedactedContentProps = {
  reason?: string;
};
export function RedactedContent({ reason }: RedactedContentProps) {
  return (
    <Text>
      <MessageDeletedContent reason={reason} />
    </Text>
  );
}

export function UnsupportedContent() {
  return (
    <Text>
      <MessageUnsupportedContent />
    </Text>
  );
}

export function BrokenContent() {
  return (
    <Text>
      <MessageBrokenContent />
    </Text>
  );
}

type RenderBodyProps = {
  body: string;
  customBody?: string;
};
type MTextProps = {
  edited?: boolean;
  content: Record<string, unknown>;
  renderBody: (props: RenderBodyProps) => ReactNode;
  renderUrlsPreview?: (urls: string[]) => ReactNode;
  style?: CSSProperties;
};
export function MText({ edited, content, renderBody, renderUrlsPreview, style }: MTextProps) {
  const { body, formatted_body: customBody } = content;

  if (typeof body !== 'string') return <BrokenContent />;
  const trimmedBody = trimReplyFromBody(body);
  const urlsMatch = renderUrlsPreview && trimmedBody.match(URL_REG);
  const urls = urlsMatch ? [...new Set(urlsMatch)] : undefined;

  return (
    <Box direction="Column">
      <MessageTextBody
        preWrap={typeof customBody !== 'string'}
        jumboEmoji={isJumboEmoji(trimmedBody)}
        style={style}
      >
        {renderBody({
          body: trimmedBody,
          customBody: typeof customBody === 'string' ? customBody : undefined,
        })}
        {edited && <MessageEditedContent />}
      </MessageTextBody>
      {renderUrlsPreview && urls && urls.length > 0 && renderUrlsPreview(urls)}
    </Box>
  );
}

type MEmoteProps = {
  displayName: string;
  edited?: boolean;
  content: Record<string, unknown>;
  renderBody: (props: RenderBodyProps) => ReactNode;
  renderUrlsPreview?: (urls: string[]) => ReactNode;
};
export function MEmote({
  displayName,
  edited,
  content,
  renderBody,
  renderUrlsPreview,
}: MEmoteProps) {
  const { body, formatted_body: customBody } = content;

  if (typeof body !== 'string') return <BrokenContent />;
  const trimmedBody = trimReplyFromBody(body);
  const urlsMatch = renderUrlsPreview && trimmedBody.match(URL_REG);
  const urls = urlsMatch ? [...new Set(urlsMatch)] : undefined;

  return (
    <Box direction="Column">
      <MessageTextBody
        emote
        preWrap={typeof customBody !== 'string'}
        jumboEmoji={isJumboEmoji(trimmedBody)}
      >
        <b>{`${displayName} `}</b>
        {renderBody({
          body: trimmedBody,
          customBody: typeof customBody === 'string' ? customBody : undefined,
        })}
        {edited && <MessageEditedContent />}
      </MessageTextBody>
      {renderUrlsPreview && urls && urls.length > 0 && renderUrlsPreview(urls)}
    </Box>
  );
}

type MNoticeProps = {
  edited?: boolean;
  content: Record<string, unknown>;
  renderBody: (props: RenderBodyProps) => ReactNode;
  renderUrlsPreview?: (urls: string[]) => ReactNode;
};
export function MNotice({ edited, content, renderBody, renderUrlsPreview }: MNoticeProps) {
  const { body, formatted_body: customBody } = content;

  if (typeof body !== 'string') return <BrokenContent />;
  const trimmedBody = trimReplyFromBody(body);
  const urlsMatch = renderUrlsPreview && trimmedBody.match(URL_REG);
  const urls = urlsMatch ? [...new Set(urlsMatch)] : undefined;

  return (
    <Box direction="Column">
      <MessageTextBody
        notice
        preWrap={typeof customBody !== 'string'}
        jumboEmoji={isJumboEmoji(trimmedBody)}
      >
        {renderBody({
          body: trimmedBody,
          customBody: typeof customBody === 'string' ? customBody : undefined,
        })}
        {edited && <MessageEditedContent />}
      </MessageTextBody>
      {renderUrlsPreview && urls && urls.length > 0 && renderUrlsPreview(urls)}
    </Box>
  );
}

type RenderImageContentProps = {
  body: string;
  filename?: string;
  info?: IImageInfo & IThumbnailContent;
  mimeType?: string;
  url: string;
  encInfo?: IEncryptedFile;
  markedAsSpoiler?: boolean;
  spoilerReason?: string;
};
type MImageProps = {
  content: IImageContent;
  renderImageContent: (props: RenderImageContentProps) => ReactNode;
  outlined?: boolean;
};
export function MImage({ content, renderImageContent, outlined }: MImageProps) {
  const imgInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;
  if (typeof mxcUrl !== 'string') {
    return <BrokenContent />;
  }
  // Size the box to the image's own ratio rather than fixing the width and
  // deriving a height: with `object-fit: cover` any mismatch between the two
  // was resolved by cropping the image, so portrait attachments lost their top
  // and bottom. Both dimensions come from `fitWithin`, and the CSS now uses
  // `contain`, so nothing is cut off.
  const [width, height] = fitWithin(imgInfo?.w, imgInfo?.h, 400, 600);

  return (
    <Attachment outlined={outlined} style={{ width: toRem(width) }}>
      <AttachmentBox
        style={{
          width: toRem(width),
          height: toRem(height < 48 ? 48 : height),
        }}
      >
        {renderImageContent({
          body: content.body || 'Image',
          info: imgInfo,
          mimeType: getImageSafeMimeType(imgInfo?.mimetype),
          url: mxcUrl,
          encInfo: content.file,
          markedAsSpoiler: content[MATRIX_SPOILER_PROPERTY_NAME],
          spoilerReason: content[MATRIX_SPOILER_REASON_PROPERTY_NAME],
        })}
      </AttachmentBox>
    </Attachment>
  );
}

type RenderVideoContentProps = {
  body: string;
  info: IVideoInfo & IThumbnailContent;
  mimeType: string;
  url: string;
  encInfo?: IEncryptedFile;
  /** The sender marked this as a GIF, so it should loop rather than be played. */
  gif: boolean;
  markedAsSpoiler?: boolean;
  spoilerReason?: string;
};
type MVideoProps = {
  content: IVideoContent;
  renderAsFile: () => ReactNode;
  renderVideoContent: (props: RenderVideoContentProps) => ReactNode;
  outlined?: boolean;
};
export function MVideo({ content, renderAsFile, renderVideoContent, outlined }: MVideoProps) {
  const videoInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;
  const safeMimeType = getBlobSafeMimeType(videoInfo?.mimetype ?? '');

  if (!videoInfo || !safeMimeType.startsWith('video') || typeof mxcUrl !== 'string') {
    if (mxcUrl) {
      return renderAsFile();
    }
    return <BrokenContent />;
  }

  const height = scaleYDimension(videoInfo.w || 400, 400, videoInfo.h || 400);

  const filename = content.filename ?? content.body ?? 'Video';

  return (
    <Attachment outlined={outlined}>
      <AttachmentHeader>
        <FileHeader
          body={filename}
          mimeType={safeMimeType}
          after={
            <FileDownloadButton
              filename={filename}
              url={mxcUrl}
              mimeType={safeMimeType}
              encInfo={content.file}
            />
          }
        />
      </AttachmentHeader>
      <AttachmentBox
        style={{
          height: toRem(height < 48 ? 48 : height),
        }}
      >
        {renderVideoContent({
          body: content.body || 'Video',
          // Written by the GIF picker on send. Until now nothing read it back
          // when rendering, so a GIF arrived as an ordinary video: a Watch
          // button, then autoplay-and-loop — the loop being right by accident.
          gif: content[MATRIX_GIF_PROPERTY_NAME] === true,
          info: videoInfo,
          mimeType: safeMimeType,
          url: mxcUrl,
          encInfo: content.file,
          markedAsSpoiler: content[MATRIX_SPOILER_PROPERTY_NAME],
          spoilerReason: content[MATRIX_SPOILER_REASON_PROPERTY_NAME],
        })}
      </AttachmentBox>
    </Attachment>
  );
}

type RenderAudioContentProps = {
  info: IAudioInfo;
  mimeType: string;
  url: string;
  encInfo?: IEncryptedFile;
};
type MAudioProps = {
  content: IAudioContent;
  renderAsFile: () => ReactNode;
  renderAudioContent: (props: RenderAudioContentProps) => ReactNode;
  outlined?: boolean;
};
export function MAudio({ content, renderAsFile, renderAudioContent, outlined }: MAudioProps) {
  const audioInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;
  const safeMimeType = getBlobSafeMimeType(audioInfo?.mimetype ?? '');

  if (!audioInfo || !safeMimeType.startsWith('audio') || typeof mxcUrl !== 'string') {
    if (mxcUrl) {
      return renderAsFile();
    }
    return <BrokenContent />;
  }

  const filename = content.filename ?? content.body ?? 'Audio';
  return (
    <Attachment outlined={outlined}>
      <AttachmentHeader>
        <FileHeader
          body={filename}
          mimeType={safeMimeType}
          after={
            <FileDownloadButton
              filename={filename}
              url={mxcUrl}
              mimeType={safeMimeType}
              encInfo={content.file}
            />
          }
        />
      </AttachmentHeader>
      <AttachmentBox>
        <AttachmentContent>
          {renderAudioContent({
            info: audioInfo,
            mimeType: safeMimeType,
            url: mxcUrl,
            encInfo: content.file,
          })}
        </AttachmentContent>
      </AttachmentBox>
    </Attachment>
  );
}

type MVoiceProps = {
  content: IAudioContent;
  renderAsFile: () => ReactNode;
  renderVoiceContent: (props: RenderAudioContentProps) => ReactNode;
};
/**
 * A voice message: the platform audio element, and nothing else.
 *
 * No attachment card, no header, no separate download button. Every one of
 * those was chrome wrapped around a control that already provides the same
 * affordance — the native player carries its own surface, and its overflow menu
 * carries "Download" — so the card only added a grey slab and a second button
 * that did what the first one already did. The filename is worth even less: it
 * is the synthetic "Voice message.ogg" every client stamps on a voice note, not
 * anything the sender chose.
 */
export function MVoice({ content, renderAsFile, renderVoiceContent }: MVoiceProps) {
  const audioInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;
  const safeMimeType = getBlobSafeMimeType(audioInfo?.mimetype ?? '');

  if (!safeMimeType.startsWith('audio') || typeof mxcUrl !== 'string') {
    if (mxcUrl) return renderAsFile();
    return <BrokenContent />;
  }

  return (
    // The card is gone but its sizing is not: `Attachment` pinned every
    // attachment to 400px, and dropping the wrapper without replacing that
    // would let the player stretch to the full timeline width on a wide window.
    <Box direction="Column" style={{ width: toRem(400), maxWidth: '100%', minWidth: 0 }}>
      {renderVoiceContent({
        info: audioInfo ?? {},
        mimeType: safeMimeType,
        url: mxcUrl,
        encInfo: content.file,
      })}
    </Box>
  );
}

type RenderFileContentProps = {
  body: string;
  info: IFileInfo & IThumbnailContent;
  mimeType: string;
  url: string;
  encInfo?: IEncryptedFile;
};
type MFileProps = {
  content: IFileContent;
  renderFileContent: (props: RenderFileContentProps) => ReactNode;
  outlined?: boolean;
};
export function MFile({ content, renderFileContent, outlined }: MFileProps) {
  const fileInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;

  if (typeof mxcUrl !== 'string') {
    return <BrokenContent />;
  }

  return (
    <Attachment outlined={outlined}>
      <AttachmentHeader>
        <FileHeader
          body={content.filename ?? content.body ?? 'Unnamed File'}
          mimeType={fileInfo?.mimetype ?? FALLBACK_MIMETYPE}
        />
      </AttachmentHeader>
      <AttachmentBox>
        <AttachmentContent>
          {renderFileContent({
            body: content.filename ?? content.body ?? 'File',
            info: fileInfo ?? {},
            mimeType: fileInfo?.mimetype ?? FALLBACK_MIMETYPE,
            url: mxcUrl,
            encInfo: content.file,
          })}
        </AttachmentContent>
      </AttachmentBox>
    </Attachment>
  );
}

type MLocationProps = {
  content: IContent;
  /** Drawn above the link when the viewer has opted into maps. */
  renderMap?: (position: { latitude: string; longitude: string }) => ReactNode;
};
export function MLocation({ content, renderMap }: MLocationProps) {
  const geoUri = content.geo_uri;
  if (typeof geoUri !== 'string') return <BrokenContent />;
  const location = parseGeoUri(geoUri);
  if (!location) return <BrokenContent />;

  // The description the sender gave, when there is one, beats showing them the
  // raw `geo:` URI they never typed.
  const label = typeof content.body === 'string' && content.body ? content.body : geoUri;

  return (
    <Box direction="Column" alignItems="Start" gap="100">
      {renderMap?.(location)}
      <Text size="T400">{label}</Text>
      <Chip
        as="a"
        size="400"
        href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`}
        target="_blank"
        rel="noreferrer noopener"
        variant="Primary"
        radii="Pill"
        before={<Icon src={Icons.External} size="50" />}
      >
        <Text size="B300">Open Location</Text>
      </Chip>
    </Box>
  );
}

type MStickerProps = {
  content: IImageContent;
  renderImageContent: (props: RenderImageContentProps) => ReactNode;
};
export function MSticker({ content, renderImageContent }: MStickerProps) {
  const imgInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;
  if (typeof mxcUrl !== 'string') {
    return <MessageBrokenContent />;
  }
  const height = scaleYDimension(imgInfo?.w || 152, 152, imgInfo?.h || 152);

  return (
    <AttachmentBox
      style={{
        height: toRem(height < 48 ? 48 : height),
        width: toRem(152),
      }}
    >
      {renderImageContent({
        body: content.body || 'Sticker',
        info: imgInfo,
        mimeType: getImageSafeMimeType(imgInfo?.mimetype),
        url: mxcUrl,
        encInfo: content.file,
      })}
    </AttachmentBox>
  );
}
