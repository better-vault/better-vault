/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The backend for accounts and subscriptions (lib/account/config.ts). */
  readonly VITE_BETTER_VAULT_API?: string;
  /** The app version, from package.json. */
  readonly VITE_APP_VERSION: string;
  /** Google OAuth web client, for Google Drive in the web app (see vite.shared.ts). */
  readonly VITE_GOOGLE_CLIENT_ID: string;
  /** Google API key, for the Google Picker. */
  readonly VITE_GOOGLE_API_KEY: string;
  /** The Google Cloud project number, for the Google Picker. */
  readonly VITE_GOOGLE_APP_ID: string;
  /** Google OAuth desktop client, for Google Drive in the desktop app. */
  readonly VITE_GOOGLE_DESKTOP_CLIENT_ID: string;
  /** Microsoft Entra app, for OneDrive on the web and desktop. */
  readonly VITE_MICROSOFT_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
