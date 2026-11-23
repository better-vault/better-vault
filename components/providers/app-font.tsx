import { useEffect } from "react";
import { applyAppFont, useAppFont } from "@/lib/theme/font";

/** Applies the font uploaded in Appearance to the whole app, or the app's own when removed. */
export function AppFont() {
  const font = useAppFont();
  useEffect(() => {
    if (font === undefined) return;
    applyAppFont(font).catch((error: unknown) => console.error("Custom font failed", error));
  }, [font]);
  return null;
}
