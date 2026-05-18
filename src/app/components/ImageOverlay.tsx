import { FocusTrap } from 'focus-trap-react';
import { as, Modal, Overlay, OverlayBackdrop, OverlayCenter } from 'folds';
import React, { ReactNode } from 'react';
import { ModalWide } from '../styles/Modal.css';
import { stopPropagation } from '../utils/keyboard';

export type RenderViewerProps = {
  src: string;
  alt: string;
  requestClose: () => void;
  // When set, the "open in browser" button opens this URL instead of `src`.
  // Used by embed previews so opening the gallery image opens the source
  // tweet/post/page instead of the raw pbs.twimg.com / blob: media URL.
  externalUrl?: string;
};

type ImageOverlayProps = RenderViewerProps & {
  viewer: boolean;
  renderViewer: (props: RenderViewerProps) => ReactNode;
};

export const ImageOverlay = as<'div', ImageOverlayProps>(
  ({ src, alt, viewer, requestClose, renderViewer, externalUrl, ...props }, ref) => (
    <Overlay {...props} ref={ref} open={viewer} backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            onDeactivate: () => requestClose(),
            clickOutsideDeactivates: true,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal
            className={ModalWide}
            size="500"
            onContextMenu={(evt: any) => evt.stopPropagation()}
          >
            {renderViewer({
              src,
              alt,
              requestClose,
              externalUrl,
            })}
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  )
);
