import { useReducer } from 'react';

const reducer = (prevCount: number): number => prevCount + 1;

export const useForceUpdate = (): [number, () => void] => {
  // React 19 changed useReducer's generics to `<S, A extends AnyActionArg>`, so
  // the old `useReducer<typeof reducer>` form no longer type-checks. Inference
  // handles it: S = number, and A = [] because `reducer` takes no action arg,
  // which is what makes `dispatch` a plain `() => void`.
  const [state, dispatch] = useReducer(reducer, 0);

  return [state, dispatch];
};
