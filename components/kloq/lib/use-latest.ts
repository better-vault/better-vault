import { type RefObject, useLayoutEffect, useRef } from "react";

/** A ref that always holds the latest render's value, for callbacks and rAF loops. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
