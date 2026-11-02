/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The app version, from package.json. */
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
