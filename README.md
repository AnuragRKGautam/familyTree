# Private Family Tree

Private interactive family-tree website for approved relatives. Static React frontend on Cloudflare Pages; Supabase Free for Auth, PostgreSQL (RLS), and private photo storage.

## Stack

- React + TypeScript + Vite
- [`family-chart@0.9.0`](https://www.npmjs.com/package/family-chart) (MIT) via a thin adapter — see [docs/implementation-plan.md](docs/implementation-plan.md)
- Supabase Free (Auth, Postgres, Storage)
- Cloudflare Pages (static)

No paid chart libraries, email providers, or search services. No service-role keys in the browser.

## Local chart prototype (no backend)

Before wiring more backend work, review the fictional chart:

```bash
npm install
npm run dev
```

Open **http://localhost:5173/prototype**

- ~36 fictional people (four generations, half-siblings, adoptive links, disconnected Ash branch, repeated names)
- Search, selection, profile panel, focus, fit-to-view, zoom/pan
- Limitations: [docs/chart-prototype-limitations.md](docs/chart-prototype-limitations.md)

## Local development (full app + Supabase)

```bash
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (anon/public only)

npm install
npm run dev
```

Signed-in app: `/` and `/tree` (auth required). Local chart prototype (no auth): `/prototype`.

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

## Manual Cloudflare Pages / Workers setup

`familytree.pages.dev` may still be an **old** static site. Connect this GitHub repo (`AnuragRKGautam/familyTree`, branch `main`) so deploys use the Vite app.

### If you see **Build output directory** (classic Pages)

| Setting | Value |
|--------|--------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (empty) |

### If you do **not** see Output directory (Workers Builds UI)

That UI only has build/deploy commands. Output dir comes from [`wrangler.toml`](wrangler.toml):

| Setting | Value |
|--------|--------|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` (default is fine) |
| Root directory | leave empty |

Also set **build** env vars (Vite bakes them in at build time):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

SPA fallback is configured via `not_found_handling = "single-page-application"` in `wrangler.toml` (do not use a catch-all `_redirects` to `/index.html`).

## Roles

| Role | Capabilities |
|------|----------------|
| `viewer` | Read tree, search, profiles |
| `editor` | Add/edit people, relationships, photos |
| `admin` | Everything editors can do + invite/approve users / change roles |

Permissions are enforced with Postgres RLS, not only the UI.

### Inviting users (admin)

1. Apply these SQL migrations in order (once each) in the Supabase SQL editor:
   - [`supabase/migrations/20260322200000_user_invites.sql`](supabase/migrations/20260322200000_user_invites.sql)
   - [`supabase/migrations/20260322210000_family_scoped_access.sql`](supabase/migrations/20260322210000_family_scoped_access.sql)
2. Sign in as admin → **Users & access**.
3. **Add invite** with email + role. For **editors**, also set a **family access root** person.
4. Relative opens **`/signup`**, registers with that email, then signs in.
5. Or they self-register; you approve them and set their access root under **Users & access**.

**Family-scoped editing:** an editor granted root person X may edit X and people at that level or below (spouses, siblings, children, deeper descendants). They cannot change ancestors above X. Admins are unrestricted. Enforced in Postgres RLS, not only the UI.

In Supabase Auth settings, enable email sign-ups. For easiest testing you may disable “Confirm email” on the free tier.

## Security notes

- Chart labels and biographies are rendered as React text, never as HTML.
- Photo bucket is private; the app uses short-lived signed URLs.
- Keep `.env` out of Git (see `.gitignore`).
