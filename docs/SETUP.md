# Phase 3: Supabase setup

## 1. Create the database
Create a new Supabase project for SmartVend. Open SQL Editor, create a query named **SmartVend 01 — Initial Database**, paste `supabase/migrations/001_initial.sql`, and run it once. Do not run this migration in your old vending or PesoTrack database.

## 2. Create the admin account
In Authentication → Users, add an email/password user. Confirm the email through the dashboard or email flow. Copy its user UUID. Run this separate SQL query named **SmartVend 02 — Admin Access**, replacing the placeholder:

```sql
insert into public.admins(user_id)
values ('YOUR-AUTH-USER-UUID')
on conflict do nothing;
```

There is no public sign-up in this app. A logged-in user must be in the admins table to use it.

## 3. Configure the React app
Copy `.env.example` to `.env.local`, then enter the project URL and publishable key from the project's Connect panel:

```env
VITE_DEMO_MODE=false
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

Use a publishable key (or legacy anon key), never a secret or service-role key in React. `.env.local` is ignored by Git. Set the Auth Site URL to your local Vite URL, normally `http://localhost:5173`.

```sh
npm install
npm run dev
```

Restart Vite after editing environment settings. Sign in with your admin email and password.

## 4. Verify the live connection
- Register a fictional student. Its wallet starts at ₱0.
- Reload: the student should remain.
- Change product stock, reload, and verify it remains.
- Sign out, then open `/students`: it should return to login.
- A user absent from the admins table must be denied access.

Live transactions start empty. Maya payments, wallet credits, encrypted card enrollment, and purchases are added in later phases. Card enrollment stays unavailable until backend encryption is implemented; no raw university ID identifiers are stored by Phase 3.

## Sample-data mode
For the Phase 2 preview, set `VITE_DEMO_MODE=true` and restart Vite. This mode does not connect to Supabase and resets edits on refresh. Do not deploy demo mode as your admin system.
