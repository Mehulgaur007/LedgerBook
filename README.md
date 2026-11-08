# Pawn Ledger – Windows app (v1.0.0)

Same protection system as SilverBook v16:

| Step | Who | What happens |
|---|---|---|
| Install | Customer | Runs `PawnLedger-Setup-1.0.0.exe`. The app opens on the **Activate** screen and shows a **Machine ID**. |
| Activate | Owner | Customer sends you the Machine ID → open **PawnLedger-Owner-Codes.html** → *Make activation code* → send it back. The code works only on that computer. |
| First login | Customer | Chooses shop name + password (min 6). All data is AES-256 encrypted with this password. |
| Change password | Owner only | Login screen → **Owner / Admin** → paste **today’s admin code** (Owner tool → *Make admin code*) → *Change password*. Data is kept. |
| Forgot password | Owner only | Same admin code → *Forgot password*. Old data stays locked (kept aside), a fresh ledger starts. |
| Uninstall | Owner only | Same admin code → *Uninstall* → type ERASE. Licence + data are removed and the Windows uninstaller starts. Uninstalling from Windows Settings is blocked with a message. |

A copied installation does **not** run on another computer – the licence is tied to the Machine ID.

## Build the .exe (private GitHub repo, like SilverBook)
1. Create a **private** repo and upload everything in this folder (keep `.github/workflows`).
2. GitHub → **Actions** → *Build Windows installer* → **Run workflow**.
3. When it finishes, open the run → **Artifacts** → download `PawnLedger-Setup` → `PawnLedger-Setup-1.0.0.exe`.

For a new version: change `"version"` in `package.json`, push, run the workflow again. Installing a newer version over an old one keeps the licence and data.

## Run locally in VS Code
`npm install` then `npm start` (Windows). Opening `app/index.html` directly in a browser runs the **online preview mode** (no licence, password 1234, data in that browser only).

## Files on the customer’s computer
`%APPDATA%\PawnLedger\vault\` – `licence.json`, `auth.json`, `data.enc` (encrypted) and `backup\` (one encrypted copy per day, last 60).
Settings → **Backup** downloads an encrypted backup file; **Restore** reads it back.

## Never commit / never share
`PawnLedger-Owner-Codes.html` contains your private owner key. It is **not** in this folder on purpose. Keep it on your own computer + a pen drive.

## Android
`app/js/store.js` already supports the Android (Capacitor) app with the same activation / admin codes. That is the next step.
