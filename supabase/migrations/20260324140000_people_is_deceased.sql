-- Public can see whether someone is deceased without exposing the death date.
alter table public.people
  add column if not exists is_deceased boolean
  generated always as (death_date is not null) stored;

grant select (is_deceased) on table public.people to anon;
