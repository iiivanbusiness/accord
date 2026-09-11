# SealMe Desktop

A native macOS/Windows/Linux wrapper around `app.sealme.net`, built with [Tauri](https://tauri.app). It's a thin shell — there's no bundled frontend and no local copy of the app. The window just points at the live site (see `windows[0].url` in `src-tauri/tauri.conf.json`), so it always shows whatever is currently deployed.

## What this means for changes

- **Anything that changes the web app** (new features, bug fixes, UI/CSS) needs **no changes here at all**. Push to the web app as usual — it deploys to Vercel, and this window picks it up the next time it loads, exactly like a browser tab would.
- **Only native-specific things** — the app icon, window size/title, a system tray icon, native notifications, auto-launch at login — need a change in this folder, followed by a new build and a new release for people to download.

## Running it locally

```bash
npm install
npm run tauri dev     # opens a window pointed at app.sealme.net, with devtools
```

## Building an installable app

```bash
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/` — a `.app` (macOS), `.dmg` (macOS installer), `.msi`/`.exe` (Windows), or `.deb`/`.AppImage` (Linux), depending on what platform you build on. Cross-compiling to a different OS than you're building on isn't supported by Tauri — a `.dmg` has to be built on a Mac, a `.msi` on Windows.

## Distributing without security warnings

Right now, opening the built app shows an "unidentified developer" (macOS) or "unknown publisher" (Windows) warning, which the person installing it can click through. To make that warning go away:

- **macOS**: needs an Apple Developer Program membership ($99/year) for code signing + notarization.
- **Windows**: needs a code-signing certificate from a certificate authority (roughly $100–400/year).

Neither is set up yet — add them under `src-tauri/tauri.conf.json` → `bundle.macOS`/`bundle.windows` once you have the credentials.

## Icon

`icon-source/icon-1024.png` is the source image the platform-specific icons were generated from. To change it, replace that file and regenerate with:

```bash
npx tauri icon icon-source/icon-1024.png
```

## Mac App Store build

`npm run tauri build` (above) is the **direct-distribution** build — notarized DMG from sealme.net, self-updating via the `updater` plugin. The Mac App Store needs a separate build, because Apple doesn't allow either of those things there:

```bash
npm run build:mas
```

This merges `src-tauri/tauri.macos-mas.conf.json` over the base config and compiles with the `mas` Cargo feature, which:

- Sandboxes the app (`entitlements.plist` — sandbox + network client + mic input; screen/system-audio capture in `audio.rs` is gated by the Screen Recording TCC prompt, not a sandbox entitlement, so nothing extra is needed there)
- Compiles the self-updater out entirely (`#[cfg(not(feature = "mas"))]` in `lib.rs`) rather than just leaving it unconfigured — the Store is the only update channel for a Store build
- Sets `bundle.targets` to just `["app"]` and turns off updater-artifact generation, since a `.dmg`/update bundle has no purpose in a Store submission

**Signing** isn't wired up yet — that needs an Apple Distribution certificate + Mac App Store provisioning profile from the Apple Developer portal (Individual account), which don't exist until the account is enrolled. Once they do, set these env vars before running `npm run build:mas` (Tauri's bundler picks them up automatically, no config change needed):

```bash
export APPLE_SIGNING_IDENTITY="Apple Distribution: Your Name (TEAMID)"
export APPLE_CERTIFICATE=...        # base64 .p12
export APPLE_CERTIFICATE_PASSWORD=...
```

The signed `.app` this produces still needs to be wrapped in a `.pkg` (via `productbuild`, using the *3rd Party Mac Developer Installer* cert, not the Distribution one above) before it can be uploaded through Transporter — Tauri's bundler doesn't do that last step.

**Review-risk note**: this app is a thin WKWebView pointed at `app.sealme.net` (see the module doc at the top of this file) — Apple's Guideline 4.2 rejects apps that are *just* a website in a window. The mic/system-audio capture in `audio.rs` (real native functionality, not something a browser tab can do) is the argument against that; mention it explicitly in the App Review notes when submitting so the reviewer doesn't have to go find it themselves.
