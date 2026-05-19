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
  //
  // `display: flex` + `flex-direction: column` is critical: the Modal
  // recipe's base styles cap `max-width`/`max-height` but don't make it
  // a flex container, so without these the inner PageRoot (which uses
  // `grow="Yes"`) has nothing to grow against and the content collapses
  // to its intrinsic size — looking tiny and anchored top-left.
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
    display: 'flex',
    flexDirection: 'column',
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
