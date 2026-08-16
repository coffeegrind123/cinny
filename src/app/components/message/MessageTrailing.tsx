import { createContext, useContext, ReactNode } from 'react';

/**
 * Content to hang off the END OF THE LAST LINE of a message's text.
 *
 * The read receipts need this and could not get it any other way. They are
 * computed in `Message`, which sees the message body only as an opaque
 * `children` node, so laying them out there means laying them out beside that
 * node — and a text block's box is as wide as its LONGEST line, not its last
 * one. On a message that wraps, "after the body" is therefore somewhere out to
 * the right of the last line, with a gap where the short final line ends. That
 * is the "goes as far out as the longest line" complaint, and no amount of flex
 * alignment fixes it: the receipts have to be in the same inline formatting
 * context as the text to sit after the text.
 *
 * `MessageEditedContent` has always been in that context — the msgtype
 * renderers put it inside `MessageTextBody`, after the body — which is why the
 * edited marker has never had this problem. This is the same slot, opened up so
 * something outside the renderers can fill it.
 *
 * A context rather than a prop because the alternative is threading a node from
 * `Message` through `RenderMessageContent` and every msgtype renderer, widening
 * signatures the receipts have no business appearing in.
 *
 * Only the text renderers (`MText`, `MEmote`, `MNotice`) read it. An attachment
 * has no last line to sit after, so `Message` keeps laying those out beside the
 * card and never fills this.
 */
export const MessageTrailingContext = createContext<ReactNode>(null);

export const useMessageTrailing = (): ReactNode => useContext(MessageTrailingContext);
