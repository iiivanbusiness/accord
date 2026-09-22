#!/usr/bin/env bash
# Builds the Mac App Store variant. Cargo.toml's `tauri` dependency has to
# declare `macos-private-api` for the direct-distribution build (its
# tauri.conf.json sets macOSPrivateApi: true) but must NOT declare it for
# this build (tauri.macos-mas.conf.json sets it false) — tauri-build checks
# this by reading Cargo.toml's text directly, so there is no flag that
# satisfies both at once (see the comment on that dependency line). This
# script is the only supported way to produce a MAS build: it flips the
# line off, builds, and restores it no matter how the build turns out, so
# the repo can never again be left mid-edit with a Cargo.toml that doesn't
# compile either variant.
set -euo pipefail
cd "$(dirname "$0")/.."

CARGO_TOML="src-tauri/Cargo.toml"

if ! git diff --quiet -- "$CARGO_TOML" || ! git diff --cached --quiet -- "$CARGO_TOML"; then
  echo "error: $CARGO_TOML has uncommitted changes — commit or stash them first" >&2
  echo "(this script edits that file temporarily and restores it with 'git checkout', which would discard uncommitted work)" >&2
  exit 1
fi

restore() {
  git checkout -- "$CARGO_TOML"
}
trap restore EXIT

sed -i '' 's/tauri = { version = "2", features = \["macos-private-api"\] }/tauri = { version = "2", features = [] }/' "$CARGO_TOML"

npx tauri build --config src-tauri/tauri.macos-mas.conf.json --features mas
