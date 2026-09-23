#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT_DIR="$ROOT_DIR/.build/unpacked"
CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID:-}
PUBLIC_KEY=${EXTENSION_PUBLIC_KEY:-}

case "$CLIENT_ID" in
  ""|"__GOOGLE_OAUTH_CLIENT_ID__")
    echo "Set GOOGLE_OAUTH_CLIENT_ID to a Chrome Extension OAuth client ID." >&2
    exit 1
    ;;
  *.apps.googleusercontent.com) ;;
  *)
    echo "GOOGLE_OAUTH_CLIENT_ID does not look like a Google OAuth client ID." >&2
    exit 1
    ;;
esac

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

cp "$ROOT_DIR/popup.html" "$ROOT_DIR/popup.js" \
  "$ROOT_DIR/options.html" "$ROOT_DIR/options.js" \
  "$ROOT_DIR/styles.css" "$OUTPUT_DIR/"
cp -R "$ROOT_DIR/src" "$ROOT_DIR/assets" "$ROOT_DIR/_locales" "$OUTPUT_DIR/"

sed "s|__GOOGLE_OAUTH_CLIENT_ID__|$CLIENT_ID|" \
  "$ROOT_DIR/manifest.json" > "$OUTPUT_DIR/manifest.json"

if [ -n "$PUBLIC_KEY" ]; then
  case "$PUBLIC_KEY" in
    *[!A-Za-z0-9+/=]*)
      echo "EXTENSION_PUBLIC_KEY must be a one-line base64 public key." >&2
      exit 1
      ;;
  esac

  awk -v key="$PUBLIC_KEY" '
    { print }
    /"homepage_url":/ { printf "  \"key\": \"%s\",\n", key }
  ' "$OUTPUT_DIR/manifest.json" > "$OUTPUT_DIR/manifest.json.tmp"
  mv "$OUTPUT_DIR/manifest.json.tmp" "$OUTPUT_DIR/manifest.json"
fi

echo "$OUTPUT_DIR"
