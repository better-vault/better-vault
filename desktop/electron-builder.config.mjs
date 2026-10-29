// electron-builder configuration for the better-vault desktop app.
// https://www.electron.build/configuration
//
// The version comes from the root package.json, so a release bumps one file.
//
// macOS signing and notarization read these environment variables (GitHub
// secrets in .github/workflows/desktop.yml):
//   CSC_LINK, CSC_KEY_PASSWORD        Developer ID Application certificate (.p12)
//   APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID   notarization
// Without them the build is unsigned, which is fine for local testing.
import { cpSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const notarize = Boolean(process.env.APPLE_ID && process.env.APPLE_TEAM_ID);

/**
 * Puts the standalone Next.js server (desktop/server) in the app's resources,
 * outside the asar archive: it runs in its own process and reads its files
 * from disk. electron-builder's `extraResources` always drops folders named
 * node_modules, which the server needs, so it is copied here instead. This
 * runs before signing, so the server is signed with the app.
 *
 * @param {import("electron-builder").AfterPackContext} context
 */
function copyServer(context) {
  const source = fileURLToPath(new URL("./server", import.meta.url));
  if (!existsSync(path.join(source, "server.js")))
    throw new Error("desktop/server is missing. Run `npm run build:server` first.");
  const resources =
    context.electronPlatformName === "darwin"
      ? path.join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          "Contents",
          "Resources",
        )
      : path.join(context.appOutDir, "resources");
  cpSync(source, path.join(resources, "server"), { recursive: true });
}

/** @type {import("electron-builder").Configuration} */
const config = {
  appId: "dev.better-vault.app",
  productName: "better-vault",
  copyright: "Copyright © better-vault contributors",
  extraMetadata: { version: web.version },
  directories: { output: "release", buildResources: "build" },
  files: ["dist/**", "build/icon.png", "package.json"],
  // The Next.js server is copied next to the app by `afterPack` below.
  afterPack: copyServer,
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

  // Design from Dmgly (build/dmgly): the background already holds the text,
  // the arrow and the label backgrounds. Icons and names are real Finder items.
  // The app entry has no `path`, so electron-builder uses the packaged .app.
  dmg: {
    background: "build/dmgly/assets/dmg-background.png",
    window: { width: 761, height: 406 },
    iconSize: 128,
    // Dmgly's positions were 225,125 and 535,143. Finder draws the names a
    // few points lower than its preview, so both icons sit 4 points higher
    // to centre the names on the label backgrounds in the image.
    contents: [
      { x: 225, y: 121, type: "file" },
      { x: 535, y: 139, type: "link", path: "/Applications" },
    ],
  },

  win: { target: [{ target: "nsis", arch: ["x64"] }] },
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
