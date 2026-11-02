// electron-builder configuration for the better-vault desktop app.
// https://www.electron.build/configuration
//
// The version comes from the root package.json, so a release bumps one file.
//
// macOS signing and notarization read these environment variables (GitHub
// secrets in .github/workflows/desktop.yml, given to the macOS job only: on
// Windows, electron-builder would sign with the same Apple certificate, and
// installed apps would then reject every update):
//   CSC_LINK, CSC_KEY_PASSWORD        Developer ID Application certificate (.p12)
//   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID   notarization
// Without them the build is unsigned, which is fine for local testing.
import { readFileSync } from "node:fs";

const web = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const notarize = Boolean(process.env.APPLE_ID && process.env.APPLE_TEAM_ID);

/** @type {import("electron-builder").Configuration} */
const config = {
  appId: "dev.better-vault.app",
  productName: "better-vault",
  copyright: "Copyright © better-vault contributors",
  extraMetadata: { version: web.version },
  directories: { output: "release", buildResources: "build" },
  // electron-vite's build: the main process (with the API), preload and page.
  files: ["out/**", "build/icon.png", "package.json"],
  icon: "build/icon.png",
  artifactName: "${productName}-${version}-${os}-${arch}.${ext}",
  publish: [{ provider: "github", owner: "better-vault", repo: "better-vault" }],

  mac: {
    category: "public.app-category.productivity",
    target: [
      { target: "dmg", arch: ["arm64", "x64"] },
      // macOS updates download the zip.
      { target: "zip", arch: ["arm64", "x64"] },
    ],
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.plist",
    notarize,
  },

  // The installer window. build/dmg/background.png and its @2x twin (merged
  // into one Retina image by electron-builder) hold the waves, the arrow and
  // the instruction. Icons and their names are real Finder items. The app
  // entry has no `path`, so electron-builder uses the packaged .app.
  dmg: {
    background: "build/dmg/background.png",
    window: { width: 761, height: 406 },
    iconSize: 128,
    contents: [
      { x: 225, y: 160, type: "file" },
      { x: 535, y: 160, type: "link", path: "/Applications" },
    ],
  },

  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    // Windows builds are not code-signed (the Apple certificate is for macOS
    // only), so the updater must not ask for a Windows signature. Set this back
    // to true once the builds are signed with a Windows certificate (WIN_CSC_LINK).
    verifyUpdateCodeSignature: false,
  },
  nsis: { oneClick: true, perMachine: false },

  linux: {
    target: [
      // The AppImage updates itself; the .deb is updated through electron-updater too.
      { target: "AppImage", arch: ["x64", "arm64"] },
      { target: "deb", arch: ["x64", "arm64"] },
    ],
    category: "Office",
    maintainer: "better-vault contributors",
    synopsis: "Bring-your-own-model notebooks for your sources",
  },
};

export default config;
