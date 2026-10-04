# Phase 4 — Encrypted card enrollment

Phase 4 code is ready. The function must be deployed to your Supabase project before live enrollment works. Your Phase 3 database already has the required cards table; do not rerun the initial migration.

## Setup on your laptop
Run these commands from the SmartVend project folder:

```powershell
git pull --ff-only origin main
npm install
npm test
npm run keys
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase secrets set --env-file .secrets.env
npx supabase functions deploy card-management
npm run dev
```

The project reference is the identifier in your Supabase project URL: `https://PROJECT-REF.supabase.co`. Supabase CLI login authorizes deployment from your laptop. Follow its login prompt privately.

`npm run keys` creates `.secrets.env` with two random 32-byte keys. Keep this file private and backed up; it is ignored by Git. The script refuses to overwrite it. Upload the keys with the secrets command above. Never add these keys to `.env.local`, `.env.example`, React code, or GitHub. Keep your current `.env.local` settings and `VITE_DEMO_MODE=false`.

Do not regenerate keys after enrolling cards: old ciphertext and lookups depend on the original keys. Rotation requires a separate migration and is outside this subject project's scope.

## Try the software flow
1. Sign in and register a fictional student.
2. Open Students → Encrypted card enrollment and select that student.
3. Enter the sample UID `04:A1:B2:C3:D4:E5:F6` and choose Enroll card.
4. Check that the status is Active; refresh and confirm it remains.
5. Enter the same UID and choose Verify card. It should report a match.
6. Try a different UID: it should report that the card does not match.
7. Disable the card and verify again: it can still be identified, but its status is Disabled. Verification does not authorize a purchase.

For now the UID is typed for testing. The ESP32 reader will provide the actual university ID UID during the hardware phase.

## Explain it to the professor
- The browser sends the UID through HTTPS to a protected backend function.
- The function checks the user's session and admin membership.
- AES-256-GCM encrypts the UID with a fresh random IV. The student ID is authenticated with the ciphertext, so copying it to another student fails verification.
- An independent HMAC-SHA-256 key creates a stable lookup value, allowing the backend to find a card without storing the UID in plain text.
- The backend decrypts only to confirm integrity and returns the match/status result. It does not return the UID or encryption keys.

The Supabase Table Editor can show ciphertext such as `v1:...`, a lookup value, and card status. Admin browser access is restricted to card ID, student ID, and enabled status. Do not display real card identifiers or secret keys during your presentation.

Encryption protects the stored identifier. It does not make a clonable card UID clone-resistant. The reader/card technology still needs confirmation before hardware integration.

## Endpoint
`card-management` accepts POST requests containing `action` (`enroll` or `verify`), `studentId`, and `uid`. It requires the user's bearer token and verifies it with Supabase Auth, then checks the admins table. The gateway's legacy JWT check is disabled in config because authentication is performed explicitly in the handler; anonymous enrollment remains denied.

The Edge Function uses Supabase-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only on the backend. You do not need to put either service-role credentials or encryption keys in the React app.

## Troubleshooting
- Function not found or a CORS/network error: check that `card-management` is deployed to the same project used by `.env.local`.
- Card service failed: check that both secrets exist, are 64 hexadecimal characters, and are different. Check function logs without printing keys or UIDs.
- Already enrolled: each student has one card and a card can belong to only one student. This phase does not replace enrolled cards.
- Session invalid: sign out and sign in again.
- Admin access required: verify the Auth user's UUID is present in the admins table.

## Verification completed during development
`npm test` checks normalization, encryption/decryption, fresh IVs, tampering, wrong keys, wrong student binding, keyed lookup, denied sessions, denied non-admins, duplicate enrollment, and sanitized responses. Tests use synthetic UIDs and fake database/Auth boundaries. Live Supabase deployment and physical NFC reading require your environment.
