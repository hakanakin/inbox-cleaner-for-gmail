# Google OAuth production verification

## Branding values

- App name: `Inbox Cleaner for Gmail`
- User support email: `hakan@akins.app`
- App logo: use a square PNG based on `assets/icon-512.png`
- Application home page: `https://inbox.akins.app/`
- Privacy Policy: `https://inbox.akins.app/privacy`
- Terms of Service: `https://inbox.akins.app/terms`
- Developer contact email: `hakan@akins.app`
- Authorized domain: `akins.app`

Renaming the Chrome extension does not update Google Cloud Branding. Confirm these values directly in Google Auth Platform before verification.

## Required order

1. Deploy the files in `site/` to an HTTPS custom domain you own.
2. Verify domain ownership in Google Search Console using the same Google account that manages the Cloud project.
3. In Google Cloud Console, open Google Auth Platform → Branding and enter the values above.
4. Add the custom domain under Authorized domains.
5. Under Audience, choose External and move the app to production when ready.
6. Under Data Access, keep only the Gmail scope actually used: `https://www.googleapis.com/auth/gmail.modify`.
7. In Chrome Web Store Developer Dashboard, upload the draft package to obtain the final Store item/extension ID.
8. In Google Cloud Credentials, create a production OAuth client of type **Chrome Extension** using that final extension ID.
9. Keep the committed manifest sanitized. Export the production client ID as `GOOGLE_OAUTH_CLIENT_ID`, increment the manifest version, run `./scripts/build-release.sh`, and upload the ignored ZIP.
10. Submit OAuth verification with the public URLs, scope justification, and demo video.

Do not keep using an OAuth client tied only to the locally loaded unpacked extension ID. Public Store installations must use a Chrome Extension OAuth client associated with the final Store extension ID.

## Scope justification

Inbox Cleaner for Gmail uses `gmail.modify` to list inbox messages, read limited metadata and Gmail-provided snippets for deterministic local classification, and move only user-selected messages to Trash by changing Gmail labels. The Extension does not request attachments or full message bodies, does not send Gmail data to a developer server, and does not perform automatic deletion. A read-only scope cannot provide the user-requested Trash action.

## Data-flow explanation

1. The user clicks Connect Gmail.
2. Chrome Identity opens Google OAuth and obtains a token after user consent.
3. The Extension calls `gmail.googleapis.com` directly over HTTPS.
4. Message metadata and snippets are classified locally in the browser.
5. Preferences and a limited scan cache are stored in `chrome.storage.local` for up to 24 hours.
6. No developer backend, AI service, analytics service, or advertising service receives Gmail data.
7. When the user selects messages and confirms, the Extension calls Gmail batchModify to add `TRASH` and remove `INBOX`.

## Demo-video script

Record one unedited English-language video with the OAuth project number and Chrome extension visible:

1. Open the public homepage and show links to Privacy Policy and Terms.
2. Open `chrome://extensions`, show the installed Extension and its final extension ID.
3. Open the Extension and show the local-processing/no-backend/no-auto-delete disclosure.
4. Click Connect Gmail and show the complete Google OAuth consent flow.
5. Expand the permission details so `gmail.modify` access is visible.
6. Complete login with an approved test account.
7. Scan a small test inbox and show KEEP / REVIEW / CLEAN results.
8. Select one test message, show the explicit confirmation, and move it to Trash.
9. Open Gmail Trash and show that only the selected test message moved.
10. Return to the Extension and click Disconnect.

Use a dedicated test Gmail account containing only synthetic messages. Do not expose real personal email in the recording.

## Why a security assessment may not apply

`gmail.modify` is a restricted Gmail scope. Google’s published rules generally require an annual security assessment when restricted Google user data is accessed from or through a third-party server. This Extension has no backend and processes Gmail data only on the user’s device, so it may qualify for the local-client exception. Google makes the final determination during verification; describe the architecture exactly and do not claim an exemption as guaranteed.
