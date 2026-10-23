"use client";

import { useEffect, useMemo, useState } from "react";

/** The app's sans-serif font stack, as the page has it. */
export function pageFont(): string {
  if (typeof document === "undefined") return "sans-serif";
  return getComputedStyle(document.body).fontFamily || "sans-serif";
}

/** Measures text in the page font at the mind map's size, once the web fonts have loaded. */
export function textMeasurer(weight = 500, size = 15): (text: string) => number {
  if (typeof document === "undefined") return (text) => text.length * size * 0.55;
  const context = document.createElement("canvas").getContext("2d");
  if (!context) return (text) => text.length * size * 0.55;
  context.font = `${weight} ${size}px ${pageFont()}`;
  const cache = new Map<string, number>();
  return (text) => {
    let width = cache.get(text);
    if (width === undefined) {
      width = context.measureText(text).width;
      cache.set(text, width);
    }
    return width;
  };
}

export function useTextMeasurer(): (text: string) => number {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => alive && setFontsReady(true));
    return () => {
      alive = false;
    };
  }, []);
  // Measured with the bolder root weight, so every label fits its pill.
  return useMemo(() => {
    void fontsReady;
    return textMeasurer(600);
  }, [fontsReady]);
}
