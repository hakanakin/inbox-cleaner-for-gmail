# Publishing Inbox Cleaner for Gmail

The code can be packaged now, but public release has two external prerequisites that cannot be invented in the repository: a custom domain you own and a Chrome Web Store developer account.

## 1. Publish the product website

Deploy the contents of `site/` at the root of an HTTPS custom domain.

Expected public URLs:

- `https://inbox.akins.app/`
- `https://inbox.akins.app/privacy`
- `https://inbox.akins.app/terms`
- `https://inbox.akins.app/support`

The production site is deployed on Cloudflare Pages at `inbox.akins.app`. After Chrome Web Store approval, change the homepage’s “Coming to Chrome Web Store” button to the final Store listing URL.

The website can be hosted by any static host. The domain must be owned by the publisher and verifiable in Google Search Console. A shared host subdomain is not a safe substitute for OAuth verification.

## 2. Fix Google OAuth Branding

Follow `release/google-oauth-verification.md`. The consent screen must say **Inbox Cleaner for Gmail** and display the real homepage, Privacy Policy, and Terms links.

## 3. Create the Chrome Web Store item

1. Register the publisher account in Chrome Web Store Developer Dashboard.
2. Export `GOOGLE_OAUTH_CLIENT_ID` locally and build the package with `./scripts/build-release.sh`.
3. Upload the ZIP as a draft. Its `manifest.json` is at the ZIP root.
4. Copy the final Store item/extension ID.
5. Create the production Chrome Extension OAuth client for that exact ID.
6. Keep the committed manifest placeholder unchanged. Export the production OAuth client ID and, when needed for a matching local ID, the Store public key.
7. Increment the version, rebuild, and upload the final ignored ZIP.
8. Complete Store Listing using `release/store-listing.md`.
9. Complete Privacy Practices using `release/privacy-practices.md`.
10. Add test instructions and submit for review.

## 4. Verification order

The practical sequence is:

`custom domain → public legal pages → Search Console verification → OAuth Branding → Store draft ID → production OAuth client → final ZIP → OAuth verification → Store review`

Google reviews and Chrome Web Store reviews are separate. Do not publicly announce the launch date until both are approved.

## 5. Final manual checks

- Test in a clean Chrome profile with a dedicated Gmail test account.
- Confirm the consent screen shows the correct name, icon, and URLs.
- Scan 50 messages, close/reopen the popup, and confirm state restoration.
- Test KEEP / REVIEW / CLEAN filters and sender search.
- Confirm Unsubscribe opens only an HTTPS sender URL.
- Move one selected synthetic message to Trash and verify it in Gmail.
- Disconnect and confirm local scan results disappear.
- Inspect the final ZIP and confirm it contains no `.DS_Store`, screenshots, site files, secrets, or test data.
- Confirm a production-pattern scan such as `[0-9]{6,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com` returns no committed OAuth client IDs.

## Official references

- Google OAuth branding: https://support.google.com/cloud/answer/15549049
- Google restricted-scope verification: https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
- Google OAuth policies: https://developers.google.com/identity/protocols/oauth2/policies
- Chrome Web Store publishing: https://developer.chrome.com/docs/webstore/publish/
- Chrome Web Store listing: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Chrome Web Store user-data policy: https://developer.chrome.com/docs/webstore/program-policies/policies#userdata
