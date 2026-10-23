-- Admin-managed invites: when an invited email signs up, auto-approve with the chosen role.
-- Does not use the service-role key in the browser.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.user_role not null default 'viewer',
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint invites_email_lower check (email = lower(email))
);

create unique index invites_pending_email_uidx
  on public.invites (email)
  where consumed_at is null;

create index invites_email_idx on public.invites (email);

alter table public.invites enable row level security;

create policy "Admins can read invites"
  on public.invites for select
  to authenticated
  using (public.has_role(array['admin']::public.user_role[]));

create policy "Admins can insert invites"
  on public.invites for insert
  to authenticated
  with check (public.has_role(array['admin']::public.user_role[]));

create policy "Admins can update invites"
  on public.invites for update
  to authenticated
  using (public.has_role(array['admin']::public.user_role[]))
  with check (public.has_role(array['admin']::public.user_role[]));

create policy "Admins can delete invites"
  on public.invites for delete
  to authenticated
  using (public.has_role(array['admin']::public.user_role[]));

-- Recreate signup trigger to honor pending invites.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_role public.user_role;
  invite_id uuid;
  normalized_email text := lower(coalesce(new.email, ''));
begin
  select i.id, i.role
    into invite_id, invite_role
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
  end if;

  return new;
end;
$$;
