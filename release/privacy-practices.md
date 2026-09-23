# Chrome Web Store privacy-practices answers

Use these answers in the dashboard and keep them consistent with the published Privacy Policy.

## Single purpose description

Inbox Cleaner for Gmail helps users review and clean low-value messages from their Gmail inbox. It reads limited Gmail message metadata and snippets, classifies them locally with deterministic rules, groups results by sender, and moves only user-selected messages to Trash after explicit confirmation.

## Permission justifications

### `identity`

Required to let the user authorize their own Google account through Chrome Identity and obtain an OAuth token for Gmail API requests. The Extension never asks for or handles the user’s Google password.

### `storage`

Required to store user preferences, the latest scan state, and a limited 24-hour message metadata/snippet cache locally on the user’s device. This restores the popup after it closes and reduces repeated Gmail API calls. Data is not synchronized to a developer server.

### Host permission: `https://gmail.googleapis.com/*`

Required to call the official Gmail API directly from the Extension. Calls list inbox messages, read limited metadata/snippets for local classification, show sender-provided unsubscribe headers, and update labels to move explicitly selected messages to Trash.

### OAuth scope: `gmail.modify`

Required because the Extension’s core cleanup action changes Gmail labels by removing `INBOX` and adding `TRASH` for messages the user selects and confirms. A read-only scope cannot provide this feature.

## Remote code

No. All executable JavaScript is packaged with the Extension. The Extension does not use `eval`, remotely hosted scripts, WebAssembly downloaded at runtime, or remote configuration that changes executable behavior.

## Data categories handled

Declare these categories:

- Personally identifiable information: the connected Gmail account email address and sender/recipient email addresses contained in message metadata.
- Personal communications: message subjects, snippets, sender/recipient metadata, dates, labels, and List-Unsubscribe headers.
- Authentication information: OAuth access is handled by Chrome Identity. The Extension uses the returned token for Gmail API calls but does not write it to Extension storage or transmit it elsewhere.

Do not declare financial, health, location, web history, or website-content categories; the Extension does not access them.

## Data-use certifications

Certify only while the implementation remains as currently audited:

- User data is not sold to third parties.
- User data is not used or transferred for purposes unrelated to the Extension’s single purpose.
- User data is not used or transferred to determine creditworthiness or for lending purposes.
- User data is not used for personalized advertising, retargeting, or marketing profiles.
- Humans do not read user Gmail data because no developer server receives it.
- Data is transmitted only over HTTPS to Google’s Gmail API.

## Disclosure shown before access

The connect screen says that processing runs locally in the browser, there is no backend, and there is no automatic deletion. Google’s OAuth consent screen then presents the requested Gmail permission before access is granted.
