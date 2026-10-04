-- Tag cover images + admin tag merge.
--
-- Notes on what this migration deliberately does NOT do:
-- * No new RLS policies on public.tags. The baseline already has
--   "tags_select_public" (SELECT USING true, all roles) and
--   "tags_update_valid_session" / "tags_insert_valid_session" /
--   "tags_delete_valid_session" for authenticated users. Additional permissive
--   policies would be redundant (permissive policies are OR'ed together), and
--   admin edits from /a/tags go through the server-side service-role client.
-- * view_blips is NOT recreated. The blip page resolves tag covers with a
--   separate lookup, so the view definition, grants and security_invoker
--   setting are left untouched.

alter table public.tags
  add column if not exists cover_image text;

comment on column public.tags.cover_image is
  'R2 storage key (relative to the public media base URL) or absolute URL for the tag cover image, used as an og:image fallback';

-- Merge source tag into target tag (admin-only).
-- Moves every blip association from source to target (skipping blips that
-- already carry the target tag), copies description/cover_image onto the
-- target when the target has none, then deletes the source tag.
create or replace function public.merge_tags(
  source_id uuid,
  target_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    coalesce(auth.role(), '') = 'service_role'
    or (public.is_admin() and app_security.session_is_valid())
  ) then
    raise exception 'Only admins can merge tags'
      using errcode = '42501';
  end if;

  if source_id is null or target_id is null then
    raise exception 'Source and target tags are required'
      using errcode = '22004';
  end if;

  if source_id = target_id then
    raise exception 'Source and target tags must be different'
      using errcode = '22023';
  end if;

  -- Lock both rows so concurrent edits/merges can't interleave.
  perform 1
  from public.tags
  where id in (source_id, target_id)
  order by id
  for update;

  if not exists (select 1 from public.tags where id = source_id) then
    raise exception 'Source tag % does not exist', source_id
      using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.tags where id = target_id) then
    raise exception 'Target tag % does not exist', target_id
      using errcode = 'P0002';
  end if;

  insert into public.blip_tags (blip_id, tag_id, created_at)
  select bt.blip_id, target_id, bt.created_at
  from public.blip_tags bt
  where bt.tag_id = source_id
  on conflict (blip_id, tag_id) do nothing;

  update public.tags t
  set
    description = coalesce(t.description, s.description),
    cover_image = coalesce(t.cover_image, s.cover_image)
  from public.tags s
  where t.id = target_id
    and s.id = source_id;

  delete from public.blip_tags where tag_id = source_id;
  delete from public.tags where id = source_id;
end;
$$;

comment on function public.merge_tags(uuid, uuid) is
  'Merge source tag into target tag, moving all blip associations (admin-only)';

-- Functions are executable by PUBLIC by default, and Supabase's default
-- privileges also grant EXECUTE to anon/authenticated explicitly.
revoke all on function public.merge_tags(uuid, uuid) from public;
revoke all on function public.merge_tags(uuid, uuid) from anon;
grant execute on function public.merge_tags(uuid, uuid) to authenticated;
grant execute on function public.merge_tags(uuid, uuid) to service_role;
