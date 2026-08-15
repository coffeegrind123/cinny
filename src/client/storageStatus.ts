import { useSyncExternalStore } from 'react';

type Listener = () => void;

let storageError: Error | undefined;
const listeners = new Set<Listener>();

const emitChange = () => listeners.forEach((listener) => listener());

export const resetClientStorageError = (): void => {
  storageError = undefined;
  emitChange();
};

export const reportClientStorageError = (error: Error): void => {
  storageError = error;
  emitChange();
};

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): Error | undefined => storageError;

export const useClientStorageError = (): Error | undefined =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
