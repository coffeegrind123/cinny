import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';

export const useLowAnimationMode = () => useSetting(settingsAtom, 'lowAnimationMode')[0];
