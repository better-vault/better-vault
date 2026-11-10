/** The OAuth apps of this build (vite.shared.ts). Empty strings when not set up. */
export const oauthApps = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY ?? "",
    appId: import.meta.env.VITE_GOOGLE_APP_ID ?? "",
    desktopClientId: import.meta.env.VITE_GOOGLE_DESKTOP_CLIENT_ID ?? "",
  },
  microsoft: { clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID ?? "" },
};

export type OAuthService = keyof typeof oauthApps;

/** Google Drive with only the files people pick or the app makes. */
export const googleScopes = ["https://www.googleapis.com/auth/drive.file"];
/** OneDrive: the person's files, to browse and to write better-vault's folder. */
export const microsoftScopes = ["offline_access", "User.Read", "Files.ReadWrite"];

/** Whether this build can sign in to the service, on the web or in the desktop app. */
export function oauthConfigured(service: OAuthService, desktop: boolean): boolean {
  if (service === "microsoft") return oauthApps.microsoft.clientId !== "";
  return desktop ? oauthApps.google.desktopClientId !== "" : oauthApps.google.clientId !== "";
}
