-- Private person photo bucket + RLS-style storage policies.
-- Bucket is not public; clients use signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'person-photos',
  'person-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Approved can read person photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'person-photos'
    and public.is_approved()
  );

create policy "Editors can upload person photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'person-photos'
    and public.has_role(array['editor', 'admin']::public.user_role[])
  );

create policy "Editors can update person photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'person-photos'
    and public.has_role(array['editor', 'admin']::public.user_role[])
  )
  with check (
    bucket_id = 'person-photos'
    and public.has_role(array['editor', 'admin']::public.user_role[])
  );

create policy "Admins can delete person photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'person-photos'
    and public.has_role(array['admin']::public.user_role[])
  );
