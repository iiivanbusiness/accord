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
