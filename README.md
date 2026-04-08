# Authenticator — Chrome extension for TOTP auto-fill

Automatically fill TOTP codes into OTP input fields on web pages.

## Languages / i18n

The extension UI follows **Chrome’s display language**: English (`_locales/en`) and Simplified Chinese (`_locales/zh_CN`). To try another language, change Chrome’s UI language and reload the extension if needed.

When adding new user-visible strings, update **both** `chrome-extension/_locales/en/messages.json` and `chrome-extension/_locales/zh_CN/messages.json`.

## Install

1. Clone or download this repository: `git clone https://github.com/zxyle/authenticator.git`
2. In Chrome, open `chrome://extensions/`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked** and select the `chrome-extension` folder in this repo
5. Pin **Authenticator** to the toolbar and click the icon to fill codes when needed.

## Usage

- **Add TOTP entries**: Click the extension icon → **Manage TOTP entries**, or right‑click the icon → **Options**. Enter a label and Secret (Base32); optionally add a domain pattern (e.g. `*.github.com`).
- **Import from Google Authenticator**:
  1. On your phone: Google Authenticator → menu → **Transfer accounts** → **Export accounts**
  2. Select accounts, show the QR code, capture a clear screenshot and transfer it to your computer
  3. In the extension **Options** page, use **Import Google Authenticator** and upload the QR image
  4. After import you’ll see counts for added vs skipped entries; importing the same batch again deduplicates automatically
- **Fill method A**: On a page that needs a code, open the popup and use **Fill** on an entry or **Fill current page**
- **Fill method B**: When an OTP field is detected, a **Fill with Authenticator** button may appear next to it; if several entries match, you’ll get a chooser
- **Context menu**: Right‑click in an input → **Fill TOTP with Authenticator**
- **Copy code**: In the popup, click the 6‑digit code to copy it to the clipboard

## Import notes and limitations

- **No silent read of Google Authenticator**: There is no public API to read existing secrets; you must use **Export accounts** on the phone first
- **QR decode failures**: Use a sharp, glare‑free, uncropped image; retry with a new photo if needed
- **HOTP**: Only TOTP entries are imported; HOTP entries are reported as skipped in preview/stats
- **Undo**: You can undo the most recent import in the current options session to quickly roll back mistakes

## Security

- Exported QR images are effectively plaintext for your 2FA secrets — do not share them
- Delete screenshots or temporary files after successful import
- On shared devices, use full‑disk encryption and lock your OS/browser account

## Manual QA checklist

- Import a real `otpauth-migration` QR image once and confirm “added N entries”
- Import the same image again and confirm “skipped duplicates” with no duplicate rows
- In the popup, confirm codes refresh on the 30‑second window
- On a 2FA page, confirm **Fill** and the context menu both work
- Use **Undo last import** and confirm only that import batch is removed; manually added entries stay

## Data and sync

- TOTP entries are stored locally in the browser (`chrome.storage.local`)
- **Sync settings (planned)** on the options page can store an API URL and token for a future backend that supplies TOTP entries
