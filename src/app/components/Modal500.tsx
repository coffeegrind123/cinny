import React, { ReactNode } from 'react';
import { FocusTrap } from 'focus-trap-react';
import { Modal, Overlay, OverlayBackdrop, OverlayCenter } from 'folds';
import { stopPropagation } from '../utils/keyboard';
import { ScreenSize, useScreenSizeContext } from '../hooks/useScreenSize';

type Modal500Props = {
  requestClose: () => void;
  children: ReactNode;
};
export function Modal500({ requestClose, children }: Modal500Props) {
  const isMobile = useScreenSizeContext() === ScreenSize.Mobile;

  // On mobile: fill the entire visual viewport, square corners, honour
  // safe-area insets so notches/home-bar don't obscure content. Use
  // `100dvh` (dynamic viewport height) so when the on-screen keyboard
  // opens the modal shrinks instead of pushing the bottom controls
  // off-screen the way `100vh` would.
  const mobileStyle: React.CSSProperties = {
    width: '100vw',
    height: '100dvh',
    maxWidth: 'none',
    maxHeight: 'none',
    borderRadius: 0,
    paddingTop: 'env(safe-area-inset-top)',
    paddingBottom: 'env(safe-area-inset-bottom)',
    paddingLeft: 'env(safe-area-inset-left)',
    paddingRight: 'env(safe-area-inset-right)',
    boxSizing: 'border-box',
  };

  return (
    <Overlay open backdrop={<OverlayBackdrop />}>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: false,
            clickOutsideDeactivates: true,
            onDeactivate: requestClose,
            escapeDeactivates: stopPropagation,
          }}
        >
          <Modal size="500" variant="Background" style={isMobile ? mobileStyle : undefined}>
            {children}
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}
