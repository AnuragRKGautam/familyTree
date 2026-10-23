-- Fictional seed data only. Safe to re-run after truncating people tables.
-- Does NOT create auth users. Approve your real admin profile separately:
--   update public.profiles set approved = true, role = 'admin' where email = 'you@example.com';

truncate table public.parent_child, public.partnerships, public.person_aliases, public.people cascade;

-- Fixed UUIDs for stable local demos
insert into public.people (id, first_name, last_name, gender, birth_date, death_date, biography) values
  ('11111111-1111-1111-1111-111111111101', 'Helen', 'Rivera', 'F', '1948-03-12', null, 'Fictional matriarch who collected pressed flowers.'),
  ('11111111-1111-1111-1111-111111111102', 'Arthur', 'Rivera', 'M', '1946-09-01', '2018-11-20', 'Fictional woodworker and terrible puns.'),
  ('11111111-1111-1111-1111-111111111103', 'Maya', 'Chen', 'F', '1972-07-22', null, 'Fictional botanist with a greenhouse full of ferns.'),
  ('11111111-1111-1111-1111-111111111104', 'Luis', 'Rivera', 'M', '1970-01-15', null, 'Fictional transit planner who maps every vacation.'),
  ('11111111-1111-1111-1111-111111111105', 'Sofia', 'Rivera', 'F', '1998-05-03', null, 'Fictional violin student who names her plants.'),
  ('11111111-1111-1111-1111-111111111106', 'Noah', 'Rivera', 'M', '2001-12-19', null, 'Fictional amateur astronomer.'),
  ('11111111-1111-1111-1111-111111111107', 'Elena', 'Park', 'F', '1975-04-08', null, 'Fictional sibling who runs a neighborhood bakery.');

insert into public.person_aliases (person_id, alias) values
  ('11111111-1111-1111-1111-111111111101', 'Nell'),
  ('11111111-1111-1111-1111-111111111102', 'Art'),
  ('11111111-1111-1111-1111-111111111105', 'Sofi'),
  ('11111111-1111-1111-1111-111111111103', 'May');

-- Partnerships: store with person_a_id < person_b_id
insert into public.partnerships (person_a_id, person_b_id) values
  ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111102'),
  ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111104');

insert into public.parent_child (parent_id, child_id) values
  ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111104'),
  ('11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111104'),
  ('11111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111107'),
  ('11111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111107'),
  ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111105'),
  ('11111111-1111-1111-1111-111111111104', '11111111-1111-1111-1111-111111111105'),
  ('11111111-1111-1111-1111-111111111103', '11111111-1111-1111-1111-111111111106'),
  ('11111111-1111-1111-1111-111111111104', '11111111-1111-1111-1111-111111111106');
