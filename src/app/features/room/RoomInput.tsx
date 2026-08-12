import React, {
  KeyboardEventHandler,
  RefObject,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { isKeyHotkey } from '../../utils/is-hotkey';
import { EventType, IContent, MsgType, RelationType, Room } from 'matrix-js-sdk';
import { Transforms, Editor } from 'slate';
import {
  Box,
  color,
  Dialog,
  Icon,
  IconButton,
  Icons,
  Line,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  PopOut,
  Scroll,
  Text,
  config,
  toRem,
} from 'folds';

import { useMatrixClient } from '../../hooks/useMatrixClient';
import {
  CustomEditor,
  Toolbar,
  toMatrixCustomHTML,
  toPlainText,
  AUTOCOMPLETE_PREFIXES,
  AutocompletePrefix,
  AutocompleteQuery,
  getAutocompleteQuery,
  getPrevWorldRange,
  resetEditor,
  RoomMentionAutocomplete,
  UserMentionAutocomplete,
  EmoticonAutocomplete,
  createEmoticonElement,
  moveCursor,
  safeFocusEditor,
  resetEditorHistory,
  customHtmlEqualsPlainText,
  trimCustomHtml,
  isEmptyEditor,
  getBeginCommand,
  trimCommand,
  getMentions,
} from '../../components/editor';
import { EmojiBoard, EmojiBoardTab } from '../../components/emoji-board';
import { UseStateProvider } from '../../components/UseStateProvider';
import {
  TUploadContent,
  encryptFile,
  getImageInfo,
  getMxIdLocalPart,
  mxcUrlToHttp,
  uploadContent,
} from '../../utils/matrix';
import { useTypingStatusUpdater } from '../../hooks/useTypingStatusUpdater';
import { useFilePicker } from '../../hooks/useFilePicker';
import { useKeybind } from '../../hooks/useKeybind';
import { useFilePasteHandler } from '../../hooks/useFilePasteHandler';
import { useFileDropZone, setGlobalDropHandler } from '../../hooks/useFileDrop';
import {
  TUploadItem,
  TUploadMetadata,
  roomIdToMsgDraftAtomFamily,
  roomIdToReplyDraftAtomFamily,
  roomIdToUploadItemsAtomFamily,
  roomUploadAtomFamily,
} from '../../state/room/roomInputDrafts';
import { UploadCardRenderer } from '../../components/upload-card';
import {
  UploadBoard,
  UploadBoardContent,
  UploadBoardHeader,
  UploadBoardImperativeHandlers,
} from '../../components/upload-board';
import {
  Upload,
  UploadStatus,
  UploadSuccess,
  createUploadFamilyObserverAtom,
} from '../../state/upload';
import { getDataTransferFiles, getImageUrlBlob, loadImageElement } from '../../utils/dom';
import { safeFile } from '../../utils/mimeTypes';
import { fulfilledPromiseSettledResult } from '../../utils/common';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import {
  getAudioMsgContent,
  getFileMsgContent,
  getImageMsgContent,
  getVideoMsgContent,
  getVoiceMsgContent,
} from './msgContent';
import { VoiceRecordBar } from './voice/VoiceRecordBar';
import { VoiceRecordStatus, useVoiceRecorder } from './voice/useVoiceRecorder';
import { isVoiceRecordingSupported } from '../../plugins/voice-recorder';
import { rainbowHtml } from '../../utils/rainbow';
import { EFFECT_MSG_TYPES, EffectName, isEffectName } from '../../plugins/effects';
import { PollCreatePrompt } from './poll/PollCreatePrompt';
import { LocationPicker } from './location/LocationPicker';
import { getMemberDisplayName, getMentionContent, trimReplyFromBody } from '../../utils/room';
import { CommandAutocomplete } from './CommandAutocomplete';
import { Command, SHRUG, TABLEFLIP, UNFLIP, useCommands } from '../../hooks/useCommands';
import { mobileOrTablet } from '../../utils/user-agent';
import { useElementSizeObserver } from '../../hooks/useElementSizeObserver';
import { ReplyLayout, ThreadIndicator } from '../../components/message';
import { roomToParentsAtom } from '../../state/room/roomToParents';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useImagePackRooms } from '../../hooks/useImagePackRooms';
import { usePowerLevelsContext } from '../../hooks/usePowerLevels';
import colorMXID from '../../../util/colorMXID';
import { useIsDirectRoom } from '../../hooks/useRoom';
import { useAccessiblePowerTagColors, useGetMemberPowerTag } from '../../hooks/useMemberPowerTag';
import { useRoomCreators } from '../../hooks/useRoomCreators';
import { useTheme } from '../../hooks/useTheme';
import { useRoomCreatorsTag } from '../../hooks/useRoomCreatorsTag';
import { usePowerLevelTags } from '../../hooks/usePowerLevelTags';
import { useComposingCheck } from '../../hooks/useComposingCheck';

// Bridges the global `toggle-emoji-picker` keybind into the emoji
// board's per-instance UseStateProvider scope. Lives as a child of
// the provider so it can call its setter without lifting state.
function EmojiPickerKeybind({ onToggle }: { onToggle: () => void }) {
  useKeybind('toggle-emoji-picker', onToggle);
  return null;
}

interface RoomInputProps {
  editor: Editor;
  fileDropContainerRef: RefObject<HTMLElement | null>;
  roomId: string;
  room: Room;
  /**
   * When set, everything typed here is sent as a reply in that thread, and
   * drafts are kept separately from the room's main composer — otherwise a
   * half-typed thread reply would appear in the room composer behind it.
   */
  threadRootId?: string;
  /**
   * Latest event in the thread, used for the reply fallback the spec asks for.
   * Falls back to the root when the thread has no replies yet.
   */
  threadLatestEventId?: string;
}
export const RoomInput = forwardRef<HTMLDivElement, RoomInputProps>(
  ({ editor, fileDropContainerRef, roomId, room, threadRootId, threadLatestEventId }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [enterForNewline] = useSetting(settingsAtom, 'enterForNewline');
    const [isMarkdown] = useSetting(settingsAtom, 'isMarkdown');
    const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
    const [legacyUsernameColor] = useSetting(settingsAtom, 'legacyUsernameColor');
    const direct = useIsDirectRoom();
    const commands = useCommands(mx, room);
    const emojiBtnRef = useRef<HTMLButtonElement>(null);
    const roomToParents = useAtomValue(roomToParentsAtom);
    const powerLevels = usePowerLevelsContext();
    const creators = useRoomCreators(room);

    // Drafts, attachments and the reply preview are scoped per composer, so a
    // thread panel and the room behind it never share state.
    const draftScope = threadRootId ? `${roomId}|thread:${threadRootId}` : roomId;

    const [msgDraft, setMsgDraft] = useAtom(roomIdToMsgDraftAtomFamily(draftScope));
    const [replyDraft, setReplyDraft] = useAtom(roomIdToReplyDraftAtomFamily(draftScope));
    const replyUserID = replyDraft?.userId;

    const powerLevelTags = usePowerLevelTags(room, powerLevels);
    const creatorsTag = useRoomCreatorsTag();
    const getMemberPowerTag = useGetMemberPowerTag(room, creators, powerLevels);
    const theme = useTheme();
    const accessibleTagColors = useAccessiblePowerTagColors(
      theme.kind,
      creatorsTag,
      powerLevelTags
    );

    const replyPowerTag = replyUserID ? getMemberPowerTag(replyUserID) : undefined;
    const replyPowerColor = replyPowerTag?.color
      ? accessibleTagColors.get(replyPowerTag.color)
      : undefined;
    const replyUsernameColor =
      legacyUsernameColor || direct ? colorMXID(replyUserID ?? '') : replyPowerColor;

    const [uploadBoard, setUploadBoard] = useState(true);
    const [selectedFiles, setSelectedFiles] = useAtom(roomIdToUploadItemsAtomFamily(draftScope));
    const uploadFamilyObserverAtom = createUploadFamilyObserverAtom(
      roomUploadAtomFamily,
      selectedFiles.map((f) => f.file)
    );
    const uploadBoardHandlers = useRef<UploadBoardImperativeHandlers | undefined>(undefined);

    const imagePackRooms: Room[] = useImagePackRooms(roomId, roomToParents);

    const [toolbar, setToolbar] = useSetting(settingsAtom, 'editorToolbar');
    const [autocompleteQuery, setAutocompleteQuery] =
      useState<AutocompleteQuery<AutocompletePrefix>>();

    const sendTypingStatus = useTypingStatusUpdater(mx, roomId);

    const voiceRecorder = useVoiceRecorder(roomId);
    const [pollPrompt, setPollPrompt] = useState(false);
    const [locationPrompt, setLocationPrompt] = useState(false);
    const voiceActive = voiceRecorder.status !== VoiceRecordStatus.Idle;
    // Checked once rather than per render: a build without WASM or without
    // getUserMedia can never record, and offering a button that always fails is
    // worse than not offering it.
    const voiceSupported = useMemo(() => isVoiceRecordingSupported(), []);

    const handleFiles = useCallback(
      async (files: File[]) => {
        setUploadBoard(true);
        const safeFiles = files.map(safeFile);
        const fileItems: TUploadItem[] = [];

        if (room.hasEncryptionStateEvent()) {
          const encryptFiles = fulfilledPromiseSettledResult(
            await Promise.allSettled(safeFiles.map((f) => encryptFile(f)))
          );
          encryptFiles.forEach((ef) =>
            fileItems.push({
              ...ef,
              metadata: {
                markedAsSpoiler: false,
              },
            })
          );
        } else {
          safeFiles.forEach((f) =>
            fileItems.push({
              file: f,
              originalFile: f,
              encInfo: undefined,
              metadata: {
                markedAsSpoiler: false,
              },
            })
          );
        }
        setSelectedFiles({
          type: 'PUT',
          item: fileItems,
        });
      },
      [setSelectedFiles, room]
    );

    // Register this room's file handler for global (anywhere-in-window) drops.
    //
    // Only the room composer claims it. A thread composer is mounted alongside
    // the room one, so if both registered, the thread's cleanup on close would
    // null out the handler the room composer had installed — leaving
    // drag-and-drop dead in that room until you navigated away and back.
    useEffect(() => {
      if (threadRootId) return undefined;
      setGlobalDropHandler(handleFiles);
      return () => setGlobalDropHandler(null);
    }, [handleFiles, threadRootId]);

    const pickFile = useFilePicker(handleFiles, true);
    const handlePaste = useFilePasteHandler(handleFiles);

    // Upload via `mod+shift+u`. Bound here (not in GlobalKeybinds) because
    // the file picker dispatches into the active room's handleFiles —
    // RoomInput is mounted per-room so the binding is implicitly scoped.
    useKeybind('upload-file', () => {
      // Window-level shortcuts belong to the room composer. With a thread panel
      // open there are two RoomInputs listening, and both would answer — one
      // keypress, two file pickers.
      if (threadRootId) return;
      pickFile('*/*');
    });

    // Escape from anywhere in the app should refocus the composer so users
    // can keep typing without re-clicking. ReactEditor.focus is the slate
    // primitive used elsewhere in this file.
    useKeybind('focus-textarea', () => {
      // Same reason as upload-file: only the room composer answers, or the two
      // composers fight over focus every time Escape is pressed.
      if (threadRootId) return;
      // Don't steal focus from a real OS-level prompt or another input.
      const active = document.activeElement as HTMLElement | null;
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
      try {
        safeFocusEditor(editor);
      } catch {
        // editor might be unmounted; ignore
      }
    });
    const handleDrop: React.DragEventHandler = useCallback(
      (evt) => {
        evt.preventDefault();
        const files = getDataTransferFiles(evt.dataTransfer);
        if (files) handleFiles(files);
      },
      [handleFiles]
    );
    const dropZoneVisible = useFileDropZone(fileDropContainerRef, handleFiles);
    const [hideStickerBtn, setHideStickerBtn] = useState(document.body.clientWidth < 500);

    const isComposing = useComposingCheck();

    useElementSizeObserver(
      useCallback(() => fileDropContainerRef.current, [fileDropContainerRef]),
      useCallback((width) => setHideStickerBtn(width < 500), [])
    );

    useEffect(() => {
      Transforms.insertFragment(editor, msgDraft);
    }, [editor, msgDraft]);

    useEffect(
      () => () => {
        if (!isEmptyEditor(editor)) {
          const parsedDraft = JSON.parse(JSON.stringify(editor.children));
          setMsgDraft(parsedDraft);
        } else {
          setMsgDraft([]);
        }
        resetEditor(editor);
        resetEditorHistory(editor);
      },
      [roomId, editor, setMsgDraft]
    );

    const handleFileMetadata = useCallback(
      (fileItem: TUploadItem, metadata: TUploadMetadata) => {
        setSelectedFiles({
          type: 'REPLACE',
          item: fileItem,
          replacement: { ...fileItem, metadata },
        });
      },
      [setSelectedFiles]
    );

    const handleRemoveUpload = useCallback(
      (upload: TUploadContent | TUploadContent[]) => {
        const uploads = Array.isArray(upload) ? upload : [upload];
        setSelectedFiles({
          type: 'DELETE',
          item: selectedFiles.filter((f) => uploads.find((u) => u === f.file)),
        });
        uploads.forEach((u) => roomUploadAtomFamily.remove(u));
      },
      [setSelectedFiles, selectedFiles]
    );

    const handleCancelUpload = (uploads: Upload[]) => {
      uploads.forEach((upload) => {
        if (upload.status === UploadStatus.Loading) {
          mx.cancelUpload(upload.promise);
        }
      });
      handleRemoveUpload(uploads.map((upload) => upload.file));
    };

    const handleSendUpload = async (uploads: UploadSuccess[]) => {
      const contentsPromises = uploads.map(async (upload) => {
        const fileItem = selectedFiles.find((f) => f.file === upload.file);
        if (!fileItem) throw new Error('Broken upload');

        if (fileItem.file.type.startsWith('image')) {
          return getImageMsgContent(mx, fileItem, upload.mxc);
        }
        if (fileItem.file.type.startsWith('video')) {
          return getVideoMsgContent(mx, fileItem, upload.mxc);
        }
        if (fileItem.file.type.startsWith('audio')) {
          return getAudioMsgContent(fileItem, upload.mxc);
        }
        return getFileMsgContent(fileItem, upload.mxc);
      });
      handleCancelUpload(uploads);
      const contents = fulfilledPromiseSettledResult(await Promise.allSettled(contentsPromises));
      contents.forEach((content) => {
        // Attachments sent from a thread composer must stay in the thread.
        if (threadRootId) applyRelation(content as IContent);
        mx.sendMessage(roomId, content as any);
      });
    };

    /**
     * Stamps the outgoing content with whatever relation applies: an explicit
     * reply if one is drafted, otherwise the thread this composer belongs to.
     *
     * Every send path goes through here. A thread composer that forgot to do
     * this on one path (attachments, say) would drop that message into the main
     * room instead, which looks like the message went to the wrong place —
     * because it did.
     */
    const applyRelation = useCallback(
      (content: IContent) => {
        if (replyDraft) {
          content['m.relates_to'] = {
            'm.in_reply_to': {
              event_id: replyDraft.eventId,
            },
          };
          if (replyDraft.relation?.rel_type === RelationType.Thread) {
            content['m.relates_to'].event_id = replyDraft.relation.event_id;
            content['m.relates_to'].rel_type = RelationType.Thread;
            content['m.relates_to'].is_falling_back = false;
          }
          return;
        }

        if (threadRootId) {
          // A plain message in a thread still carries a reply fallback, so
          // clients that do not understand threads show it as a reply to the
          // most recent thread event rather than as a loose message.
          content['m.relates_to'] = {
            rel_type: RelationType.Thread,
            event_id: threadRootId,
            is_falling_back: true,
            'm.in_reply_to': {
              event_id: threadLatestEventId ?? threadRootId,
            },
          };
        }
      },
      [replyDraft, threadRootId, threadLatestEventId]
    );

    // Voice messages bypass the upload board on purpose. The board is a staging
    // area you add to and then send; a voice note is recorded, reviewed and
    // sent as one action, and showing it as a pending file card in between
    // would invite the user to send it twice.
    const handleSendVoice = useCallback(async () => {
      const { recording } = voiceRecorder;
      if (!recording) return;

      voiceRecorder.setSending(true);
      try {
        const file = new File([recording.blob], 'Voice message.ogg', { type: 'audio/ogg' });
        const encrypted = room.hasEncryptionStateEvent() ? await encryptFile(file) : undefined;
        const uploadFile = encrypted?.file ?? file;

        const mxc = await new Promise<string>((resolve, reject) => {
          uploadContent(mx, uploadFile, {
            // The filename says "Voice message" in every client that reads it,
            // so there is nothing to hide behind hideFilename here.
            onSuccess: resolve,
            onError: reject,
          });
        });

        const content = getVoiceMsgContent(
          {
            file: uploadFile,
            originalFile: file,
            encInfo: encrypted?.encInfo,
            metadata: { markedAsSpoiler: false },
          },
          mxc,
          recording.durationSeconds * 1000,
          recording.waveform
        );

        const mentionData = getMentions(mx, roomId, editor);
        if (replyDraft && replyDraft.userId !== mx.getUserId()) {
          mentionData.users.add(replyDraft.userId);
        }
        content['m.mentions'] = getMentionContent(
          Array.from(mentionData.users),
          mentionData.room
        );

        applyRelation(content);

        await mx.sendMessage(roomId, content as any);
        voiceRecorder.discard();
        setReplyDraft(undefined);
      } catch (e) {
        console.error('Failed to send voice message', e);
        // Back to the preview with the audio intact — a failed upload must not
        // silently eat a recording the user cannot make again.
        voiceRecorder.setSending(false);
      }
    }, [mx, room, roomId, editor, replyDraft, setReplyDraft, voiceRecorder, applyRelation]);

    const submit = useCallback(() => {
      uploadBoardHandlers.current?.handleSend();

      const commandName = getBeginCommand(editor);
      let plainText = toPlainText(editor.children, isMarkdown).trim();
      let customHtml = trimCustomHtml(
        toMatrixCustomHTML(editor.children, {
          allowTextFormatting: true,
          allowBlockMarkdown: isMarkdown,
          allowInlineMarkdown: isMarkdown,
        })
      );
      let msgType = MsgType.Text;
      let effectMsgType: string | undefined;
      const effectCommand =
        commandName && isEffectName(commandName) ? (commandName as EffectName) : undefined;

      if (commandName) {
        plainText = trimCommand(commandName, plainText);
        customHtml = trimCommand(commandName, customHtml);
      }
      if (commandName === Command.Me) {
        msgType = MsgType.Emote;
      } else if (commandName === Command.Notice) {
        msgType = MsgType.Notice;
      } else if (commandName === Command.Shrug) {
        plainText = `${SHRUG} ${plainText}`;
        customHtml = `${SHRUG} ${customHtml}`;
      } else if (commandName === Command.TableFlip) {
        plainText = `${TABLEFLIP} ${plainText}`;
        customHtml = `${TABLEFLIP} ${customHtml}`;
      } else if (commandName === Command.UnFlip) {
        plainText = `${UNFLIP} ${plainText}`;
        customHtml = `${UNFLIP} ${customHtml}`;
      } else if (commandName === Command.Rainbow || commandName === Command.RainbowMe) {
        if (commandName === Command.RainbowMe) msgType = MsgType.Emote;
        // Colour the plain text, not the generated HTML: wrapping already-built
        // markup would put a <font> tag around every tag character too.
        customHtml = rainbowHtml(plainText);
      } else if (commandName === Command.Plain) {
        // Markdown left as typed — the point of /plain is that `*this*` stays
        // `*this*`, so the HTML body is dropped entirely below.
        customHtml = plainText;
      } else if (commandName === Command.Html) {
        // The user asked for raw HTML. It is still sanitised on render, by the
        // same parser that sanitises everyone else's messages.
        customHtml = plainText;
      } else if (effectCommand) {
        // Effect messages are ordinary text with a custom msgtype. Clients that
        // do not know the msgtype fall back to showing the body, which is why
        // an empty one gets a default rather than posting a blank line.
        if (plainText === '') {
          plainText = `sends ${effectCommand}`;
          customHtml = plainText;
        }
        effectMsgType = EFFECT_MSG_TYPES[effectCommand];
      } else if (commandName) {
        const commandContent = commands[commandName as Command];
        if (commandContent) {
          commandContent.exe(plainText);
        }
        resetEditor(editor);
        resetEditorHistory(editor);
        sendTypingStatus(false);
        return;
      }

      if (plainText === '') return;

      const body = plainText;
      const formattedBody = customHtml;
      const mentionData = getMentions(mx, roomId, editor);

      const content: IContent = {
        msgtype: effectMsgType ?? msgType,
        body,
      };

      if (replyDraft && replyDraft.userId !== mx.getUserId()) {
        mentionData.users.add(replyDraft.userId);
      }

      const mMentions = getMentionContent(Array.from(mentionData.users), mentionData.room);
      content['m.mentions'] = mMentions;

      // `/html` is the one case where body and formatted body are identical on
      // purpose — the typed text IS the markup — so the usual "they match, skip
      // the HTML" shortcut would throw away the entire point of the command.
      const forceHtml = commandName === Command.Html;

      if (forceHtml || replyDraft || !customHtmlEqualsPlainText(formattedBody, body)) {
        content.format = 'org.matrix.custom.html';
        content.formatted_body = formattedBody;
      }
      applyRelation(content);
      mx.sendMessage(roomId, content as any);
      resetEditor(editor);
      resetEditorHistory(editor);
      setReplyDraft(undefined);
      sendTypingStatus(false);
    }, [
      mx,
      roomId,
      editor,
      replyDraft,
      sendTypingStatus,
      setReplyDraft,
      isMarkdown,
      commands,
      applyRelation,
    ]);

    const handleKeyDown: KeyboardEventHandler = useCallback(
      (evt) => {
        if (
          (isKeyHotkey('mod+enter', evt) || (!enterForNewline && isKeyHotkey('enter', evt))) &&
          !isComposing(evt)
        ) {
          evt.preventDefault();
          submit();
        }
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          if (autocompleteQuery) {
            setAutocompleteQuery(undefined);
            return;
          }
          setReplyDraft(undefined);
        }
      },
      [submit, setReplyDraft, enterForNewline, autocompleteQuery, isComposing]
    );

    const handleKeyUp: KeyboardEventHandler = useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          evt.preventDefault();
          return;
        }

        if (!hideActivity) {
          sendTypingStatus(!isEmptyEditor(editor));
        }

        const prevWordRange = getPrevWorldRange(editor);
        const query = prevWordRange
          ? getAutocompleteQuery<AutocompletePrefix>(editor, prevWordRange, AUTOCOMPLETE_PREFIXES)
          : undefined;
        setAutocompleteQuery(query);
      },
      [editor, sendTypingStatus, hideActivity]
    );

    const handleCloseAutocomplete = useCallback(() => {
      setAutocompleteQuery(undefined);
      safeFocusEditor(editor);
    }, [editor]);

    const handleEmoticonSelect = (key: string, shortcode: string) => {
      editor.insertNode(createEmoticonElement(key, shortcode));
      moveCursor(editor);
    };

    const handleStickerSelect = async (mxc: string, shortcode: string, label: string) => {
      const stickerUrl = mxcUrlToHttp(mx, mxc, useAuthentication);
      if (!stickerUrl) return;

      const info = await getImageInfo(
        await loadImageElement(stickerUrl),
        await getImageUrlBlob(stickerUrl)
      );

      mx.sendEvent(roomId, EventType.Sticker, {
        body: label,
        url: mxc,
        info,
      });
    };

    return (
      <div ref={ref}>
        {pollPrompt && (
          <PollCreatePrompt room={room} requestClose={() => setPollPrompt(false)} />
        )}
        {locationPrompt && (
          <LocationPicker
            room={room}
            threadRootId={threadRootId}
            requestClose={() => setLocationPrompt(false)}
          />
        )}
        {selectedFiles.length > 0 && (
          <UploadBoard
            header={
              <UploadBoardHeader
                open={uploadBoard}
                onToggle={() => setUploadBoard(!uploadBoard)}
                uploadFamilyObserverAtom={uploadFamilyObserverAtom}
                onSend={handleSendUpload}
                imperativeHandlerRef={uploadBoardHandlers}
                onCancel={handleCancelUpload}
              />
            }
          >
            {uploadBoard && (
              <Scroll size="300" hideTrack visibility="Hover">
                <UploadBoardContent>
                  {Array.from(selectedFiles)
                    .reverse()
                    .map((fileItem, index) => (
                      <UploadCardRenderer
                        // eslint-disable-next-line react/no-array-index-key
                        key={index}
                        isEncrypted={!!fileItem.encInfo}
                        fileItem={fileItem}
                        setMetadata={handleFileMetadata}
                        onRemove={handleRemoveUpload}
                      />
                    ))}
                </UploadBoardContent>
              </Scroll>
            )}
          </UploadBoard>
        )}
        <Overlay
          open={dropZoneVisible}
          backdrop={<OverlayBackdrop />}
          style={{ pointerEvents: 'none' }}
        >
          <OverlayCenter>
            <Dialog variant="Primary">
              <Box
                direction="Column"
                justifyContent="Center"
                alignItems="Center"
                gap="500"
                style={{ padding: toRem(60) }}
              >
                <Icon size="600" src={Icons.File} />
                <Text size="H4" align="Center">
                  {`Drop Files in "${room?.name || 'Room'}"`}
                </Text>
                <Text align="Center">Drag and drop files here or click for selection dialog</Text>
              </Box>
            </Dialog>
          </OverlayCenter>
        </Overlay>
        {autocompleteQuery?.prefix === AutocompletePrefix.RoomMention && (
          <RoomMentionAutocomplete
            roomId={roomId}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.UserMention && (
          <UserMentionAutocomplete
            room={room}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Emoticon && (
          <EmoticonAutocomplete
            imagePackRooms={imagePackRooms}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        {autocompleteQuery?.prefix === AutocompletePrefix.Command && (
          <CommandAutocomplete
            room={room}
            editor={editor}
            query={autocompleteQuery}
            requestClose={handleCloseAutocomplete}
          />
        )}
        <CustomEditor
          editableName="RoomInput"
          editor={editor}
          placeholder="Send a message..."
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onPaste={handlePaste}
          onDrop={handleDrop}
          top={
            <>
            {voiceRecorder.error && (
              <Box
                alignItems="Center"
                gap="200"
                style={{ padding: `${config.space.S200} ${config.space.S300} 0` }}
              >
                <Box grow="Yes">
                  <Text size="T200" style={{ color: color.Critical.Main }}>
                    {voiceRecorder.error}
                  </Text>
                </Box>
                <IconButton
                  onClick={voiceRecorder.clearError}
                  variant="SurfaceVariant"
                  size="300"
                  radii="300"
                  aria-label="Dismiss"
                >
                  <Icon src={Icons.Cross} size="50" />
                </IconButton>
              </Box>
            )}
            {voiceActive && (
              <VoiceRecordBar controls={voiceRecorder} onSend={handleSendVoice} />
            )}
            {replyDraft && (
              <div>
                <Box
                  alignItems="Center"
                  gap="300"
                  style={{ padding: `${config.space.S200} ${config.space.S300} 0` }}
                >
                  {/* Invisible spacer matching the attachment button's width so the
                      replied-to message stays aligned with the text input below.
                      The close button now lives on the right, nearer the send
                      controls — less mouse travel from the compose area. */}
                  <Box shrink="No" aria-hidden style={{ visibility: 'hidden' }}>
                    <IconButton variant="SurfaceVariant" size="300" radii="300" tabIndex={-1}>
                      <Icon src={Icons.Cross} size="50" />
                    </IconButton>
                  </Box>
                  <Box grow="Yes" direction="Row" gap="200" alignItems="Center">
                    {replyDraft.relation?.rel_type === RelationType.Thread && <ThreadIndicator />}
                    <ReplyLayout
                      userColor={replyUsernameColor}
                      username={
                        <Text size="T300" truncate>
                          <b>
                            {getMemberDisplayName(room, replyDraft.userId) ??
                              getMxIdLocalPart(replyDraft.userId) ??
                              replyDraft.userId}
                          </b>
                        </Text>
                      }
                    >
                      <Text size="T300" truncate>
                        {trimReplyFromBody(replyDraft.body)}
                      </Text>
                    </ReplyLayout>
                  </Box>
                  <Box shrink="No">
                    <IconButton
                      onClick={() => setReplyDraft(undefined)}
                      variant="SurfaceVariant"
                      size="300"
                      radii="300"
                    >
                      <Icon src={Icons.Cross} size="50" />
                    </IconButton>
                  </Box>
                </Box>
              </div>
            )}
            </>
          }
          before={
            <>
              <IconButton
                onClick={() => pickFile('*/*')}
                variant="SurfaceVariant"
                size="300"
                radii="300"
                aria-label="Attach file"
              >
                <Icon src={Icons.PlusCircle} />
              </IconButton>
              <IconButton
                onClick={() => setPollPrompt(true)}
                variant="SurfaceVariant"
                size="300"
                radii="300"
                aria-label="Create poll"
                aria-pressed={pollPrompt}
              >
                <Icon src={Icons.Bulb} />
              </IconButton>
              <IconButton
                onClick={() => setLocationPrompt(true)}
                variant="SurfaceVariant"
                size="300"
                radii="300"
                aria-label="Share location"
                aria-pressed={locationPrompt}
              >
                <Icon src={Icons.Pin} />
              </IconButton>
            </>
          }
          after={
            <>
              {voiceSupported && (
                // Tap to start, tap again to stop — deliberately not
                // hold-to-record. A hold gesture on mobile fights the swipe
                // handlers behind the composer and loses the recording the
                // moment a finger slips off the button.
                <IconButton
                  variant={voiceActive ? 'Primary' : 'SurfaceVariant'}
                  size="300"
                  radii="300"
                  aria-label={
                    voiceRecorder.status === VoiceRecordStatus.Recording
                      ? 'Stop recording'
                      : 'Record voice message'
                  }
                  aria-pressed={voiceActive}
                  disabled={
                    voiceRecorder.status === VoiceRecordStatus.Starting ||
                    voiceRecorder.status === VoiceRecordStatus.Sending
                  }
                  onClick={() => {
                    if (voiceRecorder.status === VoiceRecordStatus.Recording) {
                      voiceRecorder.stop();
                    } else if (voiceRecorder.status === VoiceRecordStatus.Idle) {
                      voiceRecorder.start();
                    }
                  }}
                >
                  <Icon
                    src={
                      voiceRecorder.status === VoiceRecordStatus.Recording ? Icons.MicMute : Icons.Mic
                    }
                  />
                </IconButton>
              )}
              <IconButton
                variant="SurfaceVariant"
                size="300"
                radii="300"
                onClick={() => setToolbar(!toolbar)}
              >
                <Icon src={toolbar ? Icons.AlphabetUnderline : Icons.Alphabet} />
              </IconButton>
              <UseStateProvider initial={undefined}>
                {(emojiBoardTab: EmojiBoardTab | undefined, setEmojiBoardTab) => (
                  <>
                    <EmojiPickerKeybind
                      onToggle={() =>
                        setEmojiBoardTab((t) =>
                          t === EmojiBoardTab.Emoji ? undefined : EmojiBoardTab.Emoji
                        )
                      }
                    />
                  <PopOut
                    offset={16}
                    alignOffset={-44}
                    position="Top"
                    align="End"
                    anchor={
                      emojiBoardTab === undefined
                        ? undefined
                        : emojiBtnRef.current?.getBoundingClientRect() ?? undefined
                    }
                    content={
                      <EmojiBoard
                        tab={emojiBoardTab}
                        onTabChange={setEmojiBoardTab}
                        imagePackRooms={imagePackRooms}
                        returnFocusOnDeactivate={false}
                        onEmojiSelect={handleEmoticonSelect}
                        onCustomEmojiSelect={handleEmoticonSelect}
                        onStickerSelect={handleStickerSelect}
                        requestClose={() => {
                          setEmojiBoardTab((t) => {
                            if (t) {
                              if (!mobileOrTablet()) safeFocusEditor(editor);
                              return undefined;
                            }
                            return t;
                          });
                        }}
                      />
                    }
                  >
                    {!hideStickerBtn && (
                      <IconButton
                        aria-pressed={emojiBoardTab === EmojiBoardTab.Sticker}
                        onClick={() => setEmojiBoardTab(EmojiBoardTab.Sticker)}
                        variant="SurfaceVariant"
                        size="300"
                        radii="300"
                      >
                        <Icon
                          src={Icons.Sticker}
                          filled={emojiBoardTab === EmojiBoardTab.Sticker}
                        />
                      </IconButton>
                    )}
                    <IconButton
                      ref={emojiBtnRef}
                      aria-pressed={
                        hideStickerBtn ? !!emojiBoardTab : emojiBoardTab === EmojiBoardTab.Emoji
                      }
                      onClick={() => setEmojiBoardTab(EmojiBoardTab.Emoji)}
                      variant="SurfaceVariant"
                      size="300"
                      radii="300"
                    >
                      <Icon
                        src={Icons.Smile}
                        filled={
                          hideStickerBtn ? !!emojiBoardTab : emojiBoardTab === EmojiBoardTab.Emoji
                        }
                      />
                    </IconButton>
                  </PopOut>
                  </>
                )}
              </UseStateProvider>
              <Box
                style={{
                  width: '1px',
                  height: '24px',
                  backgroundColor: color.SurfaceVariant.ContainerLine,
                  marginLeft: '6px',
                  marginRight: '6px',
                }}
              />
              <IconButton onClick={submit} variant="Primary" size="300" radii="300">
                <Icon src={Icons.Send} />
              </IconButton>
            </>
          }
          bottom={
            toolbar && (
              <div>
                <Line variant="SurfaceVariant" size="300" />
                <Toolbar />
              </div>
            )
          }
        />
      </div>
    );
  }
);
