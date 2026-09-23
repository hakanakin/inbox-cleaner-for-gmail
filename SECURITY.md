# Security policy

## Reporting a vulnerability

Please report security or privacy issues privately to `hakan@akins.app`.

Do not include OAuth tokens, passwords, private keys, real email content, or screenshots containing personal messages. Include only the minimum steps needed to reproduce the issue.

## Repository hygiene

The committed `manifest.json` intentionally contains an OAuth placeholder. Production OAuth client IDs and the Chrome Web Store public key are injected only into ignored build artifacts through environment variables.

Generated ZIP packages, `.wrangler/`, `.build/`, local environment files, and signing material must never be committed.
