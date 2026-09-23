#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$ROOT_DIR/manifest.json" | head -n 1)
OUTPUT="$ROOT_DIR/release/inbox-cleaner-for-gmail-$VERSION.zip"
BUILD_DIR="$ROOT_DIR/.build/unpacked"

if [ -z "$VERSION" ]; then
  echo "Could not read version from manifest.json" >&2
  exit 1
fi

"$ROOT_DIR/scripts/build-unpacked.sh" >/dev/null
rm -f "$OUTPUT"
cd "$BUILD_DIR"
zip -qr "$OUTPUT" . \
  -x '*/.DS_Store' '*.map'

echo "$OUTPUT"
