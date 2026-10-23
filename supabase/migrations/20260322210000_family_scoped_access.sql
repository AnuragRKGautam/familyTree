-- Family-scoped edit access:
-- Grant a user one or more "root" people. They may edit/add at that person and
-- below (descendants, spouses, siblings), but not change people above the root.
-- Admins remain unrestricted. SELECT stays open to approved users so the chart works.

alter table public.invites
  add column if not exists root_person_id uuid references public.people (id) on delete set null;

create table if not exists public.access_grants (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  root_person_id uuid not null references public.people (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, root_person_id)
);

create index if not exists access_grants_profile_idx on public.access_grants (profile_id);
create index if not exists access_grants_root_idx on public.access_grants (root_person_id);

alter table public.access_grants enable row level security;

drop policy if exists "Admins manage access_grants select" on public.access_grants;
drop policy if exists "Admins manage access_grants insert" on public.access_grants;
drop policy if exists "Admins manage access_grants update" on public.access_grants;
drop policy if exists "Admins manage access_grants delete" on public.access_grants;
drop policy if exists "Users read own access_grants" on public.access_grants;

create policy "Admins manage access_grants select"
  on public.access_grants for select
  to authenticated
  using (public.has_role(array['admin']::public.user_role[]));

create policy "Users read own access_grants"
  on public.access_grants for select
  to authenticated
  using (profile_id = auth.uid());

create policy "Admins manage access_grants insert"
  on public.access_grants for insert
  to authenticated
  with check (public.has_role(array['admin']::public.user_role[]));

create policy "Admins manage access_grants update"
  on public.access_grants for update
  to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

create policy "Admins manage access_grants delete"
  on public.access_grants for delete
  to authenticated
  using (public.has_role(array['admin']::public.user_role[]));

-- Root + all descendants.
create or replace function public.descendants_of(root uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with recursive tree as (
    select root as id
    union
    select pc.child_id
    from public.parent_child pc
    inner join tree t on pc.parent_id = t.id
  )
  select id from tree;
$$;

-- People an editor may mutate for the given user:
-- roots + descendants + their spouses + their siblings (same generation).
create or replace function public.scoped_person_ids(for_user uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with roots as (
    select g.root_person_id as id
    from public.access_grants g
    where g.profile_id = for_user
  ),
  core as (
    select d.id
    from roots r
    cross join lateral public.descendants_of(r.id) d
  ),
  spouses as (
    select case
      when p.person_a_id in (select id from core) then p.person_b_id
      else p.person_a_id
    end as id
    from public.partnerships p
    where p.person_a_id in (select id from core)
       or p.person_b_id in (select id from core)
  ),
  core_parents as (
    select distinct pc.parent_id as id
    from public.parent_child pc
    where pc.child_id in (select id from core)
  ),
  siblings as (
    select distinct pc.child_id as id
    from public.parent_child pc
    where pc.parent_id in (select id from core_parents)
      and pc.child_id not in (select id from core)
  )
  select id from core
  union
  select id from spouses
  union
  select id from siblings;
$$;

create or replace function public.is_orphan_person(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.parent_child pc
    where pc.parent_id = p or pc.child_id = p
  )
  and not exists (
    select 1 from public.partnerships ps
    where ps.person_a_id = p or ps.person_b_id = p
  );
$$;

create or replace function public.user_has_access_grants(for_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.access_grants g where g.profile_id = for_user
  );
$$;

-- Admins: always. Editors with grants: only scoped (+ new orphans). Editors without grants: no writes.
create or replace function public.can_mutate_person(p uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(array['admin']::public.user_role[])
    or (
      public.has_role(array['editor']::public.user_role[])
      and public.user_has_access_grants(auth.uid())
      and (
        p in (select public.scoped_person_ids(auth.uid()))
        or public.is_orphan_person(p)
      )
    );
$$;

create or replace function public.can_link_as_child(parent uuid, child uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(array['admin']::public.user_role[])
    or (
      public.has_role(array['editor']::public.user_role[])
      and public.user_has_access_grants(auth.uid())
      and (
        -- Adding someone under a scoped parent (child / below root).
        parent in (select public.scoped_person_ids(auth.uid()))
        or (
          -- Sibling link: attach child to an existing parent of someone in scope
          -- (that parent may sit above the root; the parent person stays read-only).
          (
            child in (select public.scoped_person_ids(auth.uid()))
            or public.is_orphan_person(child)
          )
          and parent in (
            select pc.parent_id
            from public.parent_child pc
            where pc.child_id in (select public.scoped_person_ids(auth.uid()))
          )
        )
      )
    );
$$;

create or replace function public.can_link_partnership(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(array['admin']::public.user_role[])
    or (
      public.has_role(array['editor']::public.user_role[])
      and public.user_has_access_grants(auth.uid())
      and (
        a in (select public.scoped_person_ids(auth.uid()))
        or b in (select public.scoped_person_ids(auth.uid()))
      )
      and (
        public.is_orphan_person(a)
        or public.is_orphan_person(b)
        or a in (select public.scoped_person_ids(auth.uid()))
        or b in (select public.scoped_person_ids(auth.uid()))
      )
    );
$$;

-- RPC for the app UI (branch + unlinked orphans editors may attach).
create or replace function public.get_my_access_scope()
returns table (person_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select s.id as person_id
  from public.scoped_person_ids(auth.uid()) s
  union
  select p.id
  from public.people p
  where public.user_has_access_grants(auth.uid())
    and public.is_orphan_person(p.id);
$$;

create or replace function public.get_my_access_roots()
returns table (root_person_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select g.root_person_id
  from public.access_grants g
  where g.profile_id = auth.uid();
$$;

grant execute on function public.get_my_access_scope() to authenticated;
grant execute on function public.get_my_access_roots() to authenticated;
grant execute on function public.can_mutate_person(uuid) to authenticated;

-- Replace write policies on people / aliases / partnerships / parent_child
drop policy if exists "Editors can insert people" on public.people;
drop policy if exists "Editors can update people" on public.people;
drop policy if exists "Editors can insert aliases" on public.person_aliases;
drop policy if exists "Editors can update aliases" on public.person_aliases;
drop policy if exists "Editors can delete aliases" on public.person_aliases;
drop policy if exists "Editors can insert partnerships" on public.partnerships;
drop policy if exists "Editors can delete partnerships" on public.partnerships;
drop policy if exists "Editors can insert parent_child" on public.parent_child;
drop policy if exists "Editors can delete parent_child" on public.parent_child;

create policy "Scoped editors can insert people"
  on public.people for insert
  to authenticated
  with check (
    public.has_role(array['admin']::public.user_role[])
    or (
      public.has_role(array['editor']::public.user_role[])
      and public.user_has_access_grants(auth.uid())
    )
  );

create policy "Scoped editors can update people"
  on public.people for update
  to authenticated
  using (public.can_mutate_person(id))
  with check (public.can_mutate_person(id));

create policy "Scoped editors can insert aliases"
  on public.person_aliases for insert
  to authenticated
  with check (public.can_mutate_person(person_id));

create policy "Scoped editors can update aliases"
  on public.person_aliases for update
  to authenticated
  using (public.can_mutate_person(person_id))
  with check (public.can_mutate_person(person_id));

create policy "Scoped editors can delete aliases"
  on public.person_aliases for delete
  to authenticated
  using (public.can_mutate_person(person_id));

create policy "Scoped editors can insert partnerships"
  on public.partnerships for insert
  to authenticated
  with check (public.can_link_partnership(person_a_id, person_b_id));

create policy "Scoped editors can delete partnerships"
  on public.partnerships for delete
  to authenticated
  using (public.can_link_partnership(person_a_id, person_b_id));

create policy "Scoped editors can insert parent_child"
  on public.parent_child for insert
  to authenticated
  with check (public.can_link_as_child(parent_id, child_id));

create policy "Scoped editors can delete parent_child"
  on public.parent_child for delete
  to authenticated
  using (public.can_link_as_child(parent_id, child_id));

-- Photo storage: only mutate photos for people in scope.
drop policy if exists "Editors can upload person photos" on storage.objects;
drop policy if exists "Editors can update person photos" on storage.objects;

create policy "Scoped editors can upload person photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'person-photos'
    and public.can_mutate_person((storage.foldername(name))[1]::uuid)
  );

create policy "Scoped editors can update person photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'person-photos'
    and public.can_mutate_person((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'person-photos'
    and public.can_mutate_person((storage.foldername(name))[1]::uuid)
  );

-- When an invited user signs up, copy invite root into access_grants.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_role public.user_role;
  invite_id uuid;
  invite_root uuid;
  normalized_email text := lower(coalesce(new.email, ''));
begin
  select i.id, i.role, i.root_person_id
    into invite_id, invite_role, invite_root
  from public.invites i
  where i.email = normalized_email
    and i.consumed_at is null
  order by i.created_at asc
  limit 1;

  insert into public.profiles (id, email, display_name, role, approved)
  values (
    new.id,
    normalized_email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(normalized_email, '@', 1)),
    coalesce(invite_role, 'viewer'),
    invite_id is not null
  )
  on conflict (id) do nothing;

  if invite_id is not null then
    update public.invites
    set consumed_at = now()
    where id = invite_id;

    if invite_root is not null and coalesce(invite_role, 'viewer') in ('editor', 'admin') then
      insert into public.access_grants (profile_id, root_person_id)
      values (new.id, invite_root)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;
