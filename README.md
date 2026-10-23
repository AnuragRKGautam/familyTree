# Private Family Tree

Private interactive family-tree website for approved relatives. Static React frontend on Cloudflare Pages; Supabase Free for Auth, PostgreSQL (RLS), and private photo storage.

## Stack

- React + TypeScript + Vite
- [`family-chart@0.9.0`](https://www.npmjs.com/package/family-chart) (MIT) via a thin adapter — see [docs/implementation-plan.md](docs/implementation-plan.md)
- Supabase Free (Auth, Postgres, Storage)
- Cloudflare Pages (static)

No paid chart libraries, email providers, or search services. No service-role keys in the browser.

## Local development

```bash
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (anon/public only)

npm install
npm run dev
```

### Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Manual Supabase setup

These steps are **not** automated by this repo.

1. Create a free Supabase project.
2. In the SQL editor, run in order:
   - [`supabase/migrations/20260322120000_init_schema.sql`](supabase/migrations/20260322120000_init_schema.sql)
   - [`supabase/migrations/20260322120100_storage_photos.sql`](supabase/migrations/20260322120100_storage_photos.sql)
   - [`supabase/seed/fictional_family.sql`](supabase/seed/fictional_family.sql) (fictional people only)
3. Create your Auth user (Email + password) in Authentication → Users.
4. Approve yourself as admin:

```sql
update public.profiles
set approved = true, role = 'admin'
where email = 'you@example.com';
```

5. Confirm the private Storage bucket `person-photos` exists (created by the storage migration).
6. Copy the project URL and **anon** key into `.env` / Cloudflare Pages env vars.
   - Never put the **service role** key in `VITE_*` variables or commit it to Git.

New sign-ups get `profiles.approved = false` until an admin approves them under **Access** in the app.

## Manual Cloudflare Pages setup

Deployment has **not** been performed by the project scaffolding. When you are ready:

1. Create a Cloudflare Pages project linked to this repository (or upload the `dist/` output).
2. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. SPA routing: do **not** add a catch-all `_redirects` rule to `/index.html` (Cloudflare rejects it as an infinite loop). With no top-level `404.html`, Pages serves the SPA root for unknown paths automatically.
5. After the first deploy, sign in and smoke-test search, chart focus, profile, and (as editor) edit flows.

## Roles

| Role | Capabilities |
|------|----------------|
| `viewer` | Read tree, search, profiles |
| `editor` | Add/edit people, relationships, photos |
| `admin` | Everything editors can do + approve users / change roles |

Permissions are enforced with Postgres RLS, not only the UI.

## Security notes

- Chart labels and biographies are rendered as React text, never as HTML.
- Photo bucket is private; the app uses short-lived signed URLs.
- Keep `.env` out of Git (see `.gitignore`).
