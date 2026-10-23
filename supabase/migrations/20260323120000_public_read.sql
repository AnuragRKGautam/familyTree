-- Public read access for the family tree (no login required).
-- Birth/death dates remain readable only for authenticated roles (column grants).
-- Writes stay restricted to approved editors/admins via existing policies.

-- People: public SELECT on non-sensitive columns for anon.
revoke select on table public.people from anon;
grant select (
  id,
  first_name,
  last_name,
  gender,
  biography,
  photo_path,
  created_at,
  updated_at
) on table public.people to anon;

-- Logged-in users may read dates (and everything else).
grant select on table public.people to authenticated;

drop policy if exists "Approved can read people" on public.people;
drop policy if exists "Anyone can read people" on public.people;
create policy "Anyone can read people"
  on public.people for select
  to anon, authenticated
  using (true);

drop policy if exists "Approved can read aliases" on public.person_aliases;
drop policy if exists "Anyone can read aliases" on public.person_aliases;
create policy "Anyone can read aliases"
  on public.person_aliases for select
  to anon, authenticated
  using (true);

drop policy if exists "Approved can read partnerships" on public.partnerships;
drop policy if exists "Anyone can read partnerships" on public.partnerships;
create policy "Anyone can read partnerships"
  on public.partnerships for select
  to anon, authenticated
  using (true);

drop policy if exists "Approved can read parent_child" on public.parent_child;
drop policy if exists "Anyone can read parent_child" on public.parent_child;
create policy "Anyone can read parent_child"
  on public.parent_child for select
  to anon, authenticated
  using (true);

-- Photos visible on the public tree (signed URLs still used by the client).
drop policy if exists "Approved can read person photos" on storage.objects;
drop policy if exists "Anyone can read person photos" on storage.objects;
create policy "Anyone can read person photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'person-photos');
