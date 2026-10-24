-- Manual sibling display order (left → right). Null means “use birth date / default”.
alter table public.parent_child
  add column if not exists sort_order integer;

comment on column public.parent_child.sort_order is
  'Display order of this child under the parent (0 = leftmost). Null falls back to birth date.';

create index if not exists parent_child_parent_sort_idx
  on public.parent_child (parent_id, sort_order);
