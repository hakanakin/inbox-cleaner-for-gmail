# Contributing

## Local setup

1. Create a Chrome Extension OAuth client for your own unpacked extension ID, or use your own Store item public key.
2. Export `GOOGLE_OAUTH_CLIENT_ID` locally.
3. Optionally export `EXTENSION_PUBLIC_KEY` as a one-line base64 public key.
4. Run `./scripts/build-unpacked.sh`.
5. Load `.build/unpacked` from `chrome://extensions`.

Never commit OAuth credentials, generated release ZIPs, real inbox data, or screenshots containing personal information.

## Before opening a change

- Run `npm run check` from the project root.
- Test connect, scan, filter, Trash confirmation, and Disconnect with a dedicated test Gmail account.
- Keep permissions minimal and preserve the explicit-confirmation requirement for Trash actions.
- Keep classification local and deterministic unless the project privacy model is deliberately reviewed and updated.
