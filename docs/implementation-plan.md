# Private Family Tree Website — Implementation Plan

## Goal

Private interactive family-tree site where approved relatives can sign in, search people, focus the chart, open profiles, navigate relatives, and add/edit records when their role permits.

## Free-hosting constraints

- React + TypeScript + Vite frontend
- Cloudflare Pages static deployment
- Supabase Free for PostgreSQL, Auth, and private photo storage
- No always-running backend, paid chart/email/search services, or keep-alive jobs
- No custom domain required
- Credentials out of Git; never put Supabase service-role keys in the browser

## Library verification (`family-chart`)

| Item | Result |
|------|--------|
| Package | `family-chart` (donatso) |
| Pinned version | **0.9.0** (exact; see `package-lock.json`) |
| License | MIT (`LICENSE.txt`); npm `package.json` field may say `ISC` |
| TypeScript | Built-in (`dist/types/index.d.ts`) |
| CSS path | `family-chart/styles/family-chart.css` → `./dist/styles/*` |
| Docs | https://donatso.github.io/family-chart/ |

### Documented APIs used (adapter only)

- `f3.createChart(container, data)`
- `chart.setCardHtml().setCardDisplay(...).setOnCardClick(...)`
- `chart.setAncestryDepth(n).setProgenyDepth(n)`
- `chart.updateMainId(id)` / `updateMain(d)`
- `chart.updateData(data).updateTree({ initial?, tree_position: 'main_to_middle' })`

### Not used

- `family-chart-premium`
- `editTree()` for persistence (in-memory; we persist via Supabase + RLS)
- Any invented filter/search methods

### Gaps handled outside the library

| Requirement | Approach |
|-------------|----------|
| Name/alias search | Postgres `ilike` + UI |
| Auth / roles / RLS / photos | Supabase Free |
| Profiles / navigation | React routes + adapter focus |
| Permissioned add/edit | Custom forms + RLS |

## Architecture

- UI components do not query Supabase directly; they call `src/data/*`
- Chart interaction goes through `src/chart/familyChartAdapter.ts`
- Schema changes live in `supabase/migrations/*.sql` with RLS on every exposed table
- Labels and biographies are untrusted plain text (no HTML rendering)

## Roles

- `viewer` — read approved data
- `editor` — create/update people, relationships, photos
- `admin` — manage profiles (approve/role) and full write access

Unauthenticated or `approved = false` users cannot read application data (RLS + UI gate).

## Phases and acceptance criteria

### Phase 0 — Docs + dependency pin

- [x] This plan document
- [x] Vite React-TS scaffold with `lint`, `typecheck`, `test`, `build`
- [x] `family-chart@0.9.0` pinned + lockfile committed
- **Accept:** lint, typecheck, tests, production build pass

### Phase 1 — App shell + auth gate

- [x] Supabase client (anon key only), email/password sign-in/out
- [x] Route gates: loading / unauthenticated / unapproved / approved
- **Accept:** approved user reaches shell; unapproved sees permission-denied; secrets not in Git

### Phase 2 — Schema, RLS, data access

- [x] Migrations for `profiles`, `people`, `person_aliases`, `partnerships`, `parent_child`
- [x] RLS policies; fictional seed data
- [x] DAL modules for people, relationships, search, profiles
- **Accept:** anonymous/unapproved denied; approved can read seed data (verify after applying SQL in your project)

### Phase 3 — Search + chart focus

- [x] Search by name/alias; select → focus chart
- [x] Adapter uses only documented APIs; ancestors/descendants/partners via `rels`
- [x] Loading / empty / error / permission-denied states
- **Accept:** search hit or card click focuses person via documented APIs

### Phase 4 — Profiles + navigation

- [x] Person profile (plain text); links to parents/partners/children
- **Accept:** relative links refocus chart; no HTML injection

### Phase 5 — Role-based add/edit + photos

- [x] Editor/admin forms; viewer read-only; private Storage + signed URLs
- **Accept:** viewer write blocked (UI + RLS); editor can write; photos not public

### Phase 6 — Deploy readiness

- [x] Cloudflare Pages config (`public/_redirects`, `_headers`); README with honest manual setup steps
- **Accept:** build ready; no secrets in repo; deploy claimed only if verified
- **Note:** Live Cloudflare/Supabase deployment was not performed by the agent.

## Quality bar (every phase)

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Manual setup (not automated)

1. Create Supabase project; run migrations; create private `person-photos` bucket
2. Create first Auth user; set `profiles.approved = true` and `role = 'admin'`
3. Create Cloudflare Pages project; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Deploy and smoke-test — do not claim live deploy until verified
