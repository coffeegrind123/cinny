import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

/**
 * The filename line above an attachment.
 *
 * Deliberately not a card, a banner or a badge. This replaced a strip that
 * filled itself with `SurfaceVariant.Container`, put the file extension in a
 * pill and parked an icon button on the right — three pieces of furniture
 * around one string. What is left is the string, at the size and priority the
 * rest of the timeline uses for secondary text.
 */
export const Caption = style([
  DefaultReset,
  {
    display: 'inline-flex',
    alignItems: 'center',
    gap: config.space.S100,
    // Hugs its own text rather than stretching across the attachment column.
    // As a flex item `inline-flex` is blockified, so without this the download
    // variant's hit area would be the full 400px row and a stray click
    // anywhere beside the filename would start a download.
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minWidth: 0,
    // Line the name up with the media below it rather than indenting it.
    padding: 0,
    marginBottom: toRem(2),
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left',
  },
]);

/** The caption doubles as the download control — see AttachmentCaption. */
export const CaptionInteractive = style({
  cursor: 'pointer',
  selectors: {
    '&:hover:not(:disabled)': {
      textDecoration: 'underline',
    },
    '&:focus-visible': {
      outline: `${config.borderWidth.B600} solid ${color.Secondary.Main}`,
      outlineOffset: toRem(2),
      borderRadius: config.radii.R300,
    },
    '&:disabled': {
      cursor: 'default',
    },
  },
});

export const CaptionCritical = style({
  color: color.Critical.Main,
});

export const CaptionName = style([
  DefaultReset,
  {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
]);

export const CaptionIcon = style([
  DefaultReset,
  {
    flexShrink: 0,
    // Present but quiet: it marks the name as clickable without competing
    // with it. It comes up to full strength on hover, like the underline.
    opacity: 0.6,
    selectors: {
      [`${CaptionInteractive}:hover &`]: {
        opacity: 1,
      },
    },
  },
]);
