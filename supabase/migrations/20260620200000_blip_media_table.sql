-- Media attachments for blips (images, video clips, GIFs) stored in Cloudflare R2.
-- Metadata lives here; binary files live in R2 under media/{user_id}/{blip_id}/...

create table public.blip_media (
  id                 uuid          not null default gen_random_uuid() primary key,
  blip_id            varchar(17)   not null references public.blips (id) on delete cascade,
  user_id            uuid          not null references auth.users (id) on delete cascade,
  media_type         text          not null,
  mime_type          text          not null,
  storage_key        text          not null,
  processing_status  text          not null default 'pending',
  file_size          bigint        not null,
  width              integer,
  height             integer,
  duration_s         integer,
  display_order      integer       not null default 0,
  created_at         timestamptz   not null default now(),
  constraint blip_media_media_type_check
    check (media_type = any (array['image'::text, 'video'::text, 'gif'::text])),
  constraint blip_media_processing_status_check
    check (processing_status = any (array['pending'::text, 'complete'::text, 'failed'::text]))
);

create index blip_media_blip_id_idx on public.blip_media using btree (blip_id);
create index blip_media_user_id_idx on public.blip_media using btree (user_id);
create index blip_media_blip_id_display_order_idx
  on public.blip_media using btree (blip_id, display_order);

alter table public.blip_media enable row level security;

-- Media visibility follows the parent blip's visibility (single source of truth).
create policy blip_media_select_follows_blip
  on public.blip_media
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.blips b
      where b.id = blip_media.blip_id
        and (
          (
            b.published is true
            and coalesce(b.publish_at, b.created_at, now()) <= now()
          )
          or (
            auth.uid() is not null
            and b.user_id = auth.uid()
          )
          or (
            public.is_admin()
            and app_security.session_is_valid()
          )
        )
    )
  );

create policy blip_media_insert_owner_valid_session
  on public.blip_media
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and app_security.session_is_valid()
  );

create policy blip_media_update_owner_valid_session
  on public.blip_media
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and app_security.session_is_valid()
  )
  with check (
    auth.uid() = user_id
    and app_security.session_is_valid()
  );

create policy blip_media_delete_owner_valid_session
  on public.blip_media
  for delete
  to authenticated
  using (
    auth.uid() = user_id
    and app_security.session_is_valid()
  );

create policy blip_media_delete_admin_all
  on public.blip_media
  for delete
  to authenticated
  using (public.is_admin() and app_security.session_is_valid());

grant select on table public.blip_media to anon, authenticated;
grant all on table public.blip_media to service_role;

-- Enable realtime so PersonalCloudImage can react to processing_status changes.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'blip_media'
  ) then
    execute 'alter publication supabase_realtime add table public.blip_media';
  end if;
end
$$;
