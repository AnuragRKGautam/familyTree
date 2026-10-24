-- Allow editors to update parent_child (needed for sort_order / sibling reordering).
-- Previously only INSERT and DELETE existed, so reorder saves were silently ignored by RLS.

drop policy if exists "Scoped editors can update parent_child" on public.parent_child;
create policy "Scoped editors can update parent_child"
  on public.parent_child for update
  to authenticated
  using (public.can_link_as_child(parent_id, child_id))
  with check (public.can_link_as_child(parent_id, child_id));
