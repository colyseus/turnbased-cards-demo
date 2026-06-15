import { useCallback, useRef } from "react";

export function useStableCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
): T {
  const ref = useRef(fn);
  ref.current = fn;

  return useCallback(
    (...args: Parameters<T>) => ref.current(...args),
    [],
  ) as T;
}
