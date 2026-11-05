"use client";

/** The resolved `KloqSettings`, shared by context; the drag engine reads it from its options ref instead. */

import { createContext, useContext } from "react";
import { DEFAULT_SETTINGS, type KloqSettings } from "../lib/calendar-config";

const SettingsContext = createContext<KloqSettings>(DEFAULT_SETTINGS);

export const SettingsProvider = SettingsContext.Provider;

/** The active geometry + formatting settings. */
export function useKloqSettings(): KloqSettings {
  return useContext(SettingsContext);
}
