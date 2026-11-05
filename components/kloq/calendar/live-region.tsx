"use client";

/**
 * The calendar's two aria-live regions and the `announce()` every commit path uses.
 * Text is written imperatively via refs: no re-render, and a cleared-then-written node re-announces repeats.
 */

import { createContext, type RefObject, useCallback, useContext, useEffect, useRef } from "react";

type Politeness = "polite" | "assertive";

/** Say something. Empty strings are ignored, so a builder may return "". */
export type Announce = (message: string, politeness?: Politeness) => void;

const noop: Announce = () => {};

const AnnounceContext = createContext<Announce>(noop);

export const AnnounceProvider = AnnounceContext.Provider;

/** The calendar's announcer; a `noop` outside a provider. */
export function useAnnounce(): Announce {
  return useContext(AnnounceContext);
}

interface Announcer {
  announce: Announce;
  politeRef: RefObject<HTMLDivElement | null>;
  assertiveRef: RefObject<HTMLDivElement | null>;
}

export function useAnnouncer(): Announcer {
  const politeRef = useRef<HTMLDivElement | null>(null);
  const assertiveRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const announce = useCallback<Announce>((message, politeness = "polite") => {
    const text = message.trim();
    if (!text) return;
    const node = politeness === "assertive" ? assertiveRef.current : politeRef.current;
    if (!node) return;
    // clear then write next frame: identical text twice is not a change, so it would not re-announce
    node.textContent = "";
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      node.textContent = text;
    });
  }, []);

  return { announce, politeRef, assertiveRef };
}

// clip-rect idiom inline (display:none/visibility:hidden drop live regions from the a11y tree)
const SR_ONLY = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: 0,
  border: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
} as const;

/** The regions; mounted once and never unmounted, or screen readers skip the first announcement. */
export function LiveRegions({ politeRef, assertiveRef }: Omit<Announcer, "announce">) {
  return (
    <>
      <div
        ref={politeRef}
        data-kloq-live="polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={SR_ONLY}
      />
      <div
        ref={assertiveRef}
        data-kloq-live="assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={SR_ONLY}
      />
    </>
  );
}
