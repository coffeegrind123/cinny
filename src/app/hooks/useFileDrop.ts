import { useCallback, DragEventHandler, RefObject, useState, useEffect, useRef } from 'react';
import { getDataTransferFiles } from '../utils/dom';

// Module-level handler for global (anywhere-in-window) file drops.
// Set by RoomInput when a conversation is open; cleared on unmount.
let globalDropHandler: ((files: File[]) => void) | null = null;

export const setGlobalDropHandler = (handler: ((files: File[]) => void) | null) => {
  globalDropHandler = handler;
};

// Call once at the app root to accept drops anywhere in the window.
// When a conversation is open, dropped files are routed to the room input.
export const useGlobalDropListener = () => {
  useEffect(() => {
    const handleDragOver = (evt: DragEvent) => {
      evt.preventDefault();
    };
    const handleDrop = (evt: DragEvent) => {
      if (evt.defaultPrevented) return;
      evt.preventDefault();
      if (!evt.dataTransfer || !globalDropHandler) return;
      const files = getDataTransferFiles(evt.dataTransfer);
      if (files) globalDropHandler(files);
    };

    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);
};

export const useFileDropHandler = (onDrop: (file: File[]) => void): DragEventHandler =>
  useCallback(
    (evt) => {
      const files = getDataTransferFiles(evt.dataTransfer);
      if (files) onDrop(files);
    },
    [onDrop]
  );

export const useFileDropZone = (
  zoneRef: RefObject<HTMLElement>,
  onDrop: (file: File[]) => void
): boolean => {
  const dragStateRef = useRef<'start' | 'leave' | 'over'>();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const target = zoneRef.current;
    const handleDrop = (evt: DragEvent) => {
      evt.preventDefault();
      dragStateRef.current = undefined;
      setActive(false);
      if (!evt.dataTransfer) return;
      const files = getDataTransferFiles(evt.dataTransfer);
      if (files) onDrop(files);
    };

    target?.addEventListener('drop', handleDrop);
    return () => {
      target?.removeEventListener('drop', handleDrop);
    };
  }, [zoneRef, onDrop]);

  useEffect(() => {
    const target = zoneRef.current;
    const handleDragEnter = (evt: DragEvent) => {
      if (evt.dataTransfer?.types.includes('Files')) {
        dragStateRef.current = 'start';
        setActive(true);
      }
    };
    const handleDragLeave = () => {
      if (dragStateRef.current !== 'over') return;
      dragStateRef.current = 'leave';
      setActive(false);
    };
    const handleDragOver = (evt: DragEvent) => {
      evt.preventDefault();
      dragStateRef.current = 'over';
    };

    target?.addEventListener('dragenter', handleDragEnter);
    target?.addEventListener('dragleave', handleDragLeave);
    target?.addEventListener('dragover', handleDragOver);
    return () => {
      target?.removeEventListener('dragenter', handleDragEnter);
      target?.removeEventListener('dragleave', handleDragLeave);
      target?.removeEventListener('dragover', handleDragOver);
    };
  }, [zoneRef]);

  return active;
};
