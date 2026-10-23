-- Family tree schema with RLS. Apply via Supabase SQL editor or CLI.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('viewer', 'editor', 'admin');
create type public.gender as enum ('M', 'F', 'U');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  role public.user_role not null default 'viewer',
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  gender public.gender not null default 'U',
  birth_date date,
  death_date date,
  biography text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.person_aliases (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  alias text not null,
  unique (person_id, alias)
);

create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  person_a_id uuid not null references public.people (id) on delete cascade,
  person_b_id uuid not null references public.people (id) on delete cascade,
  check (person_a_id <> person_b_id),
  check (person_a_id < person_b_id),
  unique (person_a_id, person_b_id)
);

create table public.parent_child (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.people (id) on delete cascade,
  child_id uuid not null references public.people (id) on delete cascade,
  check (parent_id <> child_id),
  unique (parent_id, child_id)
);

create index people_name_idx on public.people (last_name, first_name);
create index people_first_name_ilike_idx on public.people (first_name);
create index people_last_name_ilike_idx on public.people (last_name);
create index person_aliases_alias_idx on public.person_aliases (alias);
create index parent_child_parent_idx on public.parent_child (parent_id);
create index parent_child_child_idx on public.parent_child (child_id);
create index partnerships_a_idx on public.partnerships (person_a_id);
create index partnerships_b_idx on public.partnerships (person_b_id);

-- Auto-create a locked profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, approved)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    'viewer',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
  );
$$;

create or replace function public.has_role(allowed public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.approved = true
      and p.role = any (allowed)
  );
$$;

alter table public.profiles enable row level security;
alter table public.people enable row level security;
alter table public.person_aliases enable row level security;
alter table public.partnerships enable row level security;
alter table public.parent_child enable row level security;

-- Profiles
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Approved users can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_approved());

create policy "Users can update own display name"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
    and approved = (select approved from public.profiles where id = auth.uid())
  );

create policy "Admins can update profiles"
  on public.profiles for update
  to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

-- People
create policy "Approved can read people"
  on public.people for select
  to authenticated
  using (public.is_approved());

create policy "Editors can insert people"
  on public.people for insert
  to authenticated
  with check (public.has_role(array['editor', 'admin']::public.user_role[]));

create policy "Editors can update people"
  on public.people for update
  to authenticated
  using (public.has_role(array['editor', 'admin']::public.user_role[]))
  with check (public.has_role(array['editor', 'admin']::public.user_role[]));

create policy "Admins can delete people"
  on public.people for delete
  to authenticated
  using (public.has_role(array['admin']::public.user_role[]));

-- Aliases
create policy "Approved can read aliases"
  on public.person_aliases for select
  to authenticated
  using (public.is_approved());

create policy "Editors can insert aliases"
  on public.person_aliases for insert
  to authenticated
  with check (public.has_role(array['editor', 'admin']::public.user_role[]));

create policy "Editors can update aliases"
  on public.person_aliases for update
  to authenticated
  using (public.has_role(array['editor', 'admin']::public.user_role[]))
  with check (public.has_role(array['editor', 'admin']::public.user_role[]));

create policy "Editors can delete aliases"
  on public.person_aliases for delete
  to authenticated
  using (public.has_role(array['editor', 'admin']::public.user_role[]));

-- Partnerships
create policy "Approved can read partnerships"
  on public.partnerships for select
  to authenticated
  using (public.is_approved());

create policy "Editors can insert partnerships"
  on public.partnerships for insert
  to authenticated
  with check (public.has_role(array['editor', 'admin']::public.user_role[]));

create policy "Editors can delete partnerships"
  on public.partnerships for delete
  to authenticated
  using (public.has_role(array['editor', 'admin']::public.user_role[]));

-- Parent/child
create policy "Approved can read parent_child"
  on public.parent_child for select
  to authenticated
  using (public.is_approved());

create policy "Editors can insert parent_child"
  on public.parent_child for insert
  to authenticated
  with check (public.has_role(array['editor', 'admin']::public.user_role[]));

create policy "Editors can delete parent_child"
  on public.parent_child for delete
  to authenticated
  using (public.has_role(array['editor', 'admin']::public.user_role[]));
