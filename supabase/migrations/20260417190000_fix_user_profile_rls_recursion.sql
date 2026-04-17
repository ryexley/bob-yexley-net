set check_function_bodies = off;

drop policy if exists user_profile_select_visible on public.user_profile;
create policy user_profile_select_own_or_admin
on public.user_profile
for select
to authenticated
using (
  (
    user_id = auth.uid()
    and app_security.session_is_valid()
  )
  or (
    public.is_admin()
    and app_security.session_is_valid()
  )
);

create or replace view public.view_public_user
as
select
  up.id as profile_id,
  up.user_id,
  up.display_name,
  up.avatar_seed,
  up.avatar_version,
  us.status
from public.user_profile up
left join public.user_system us
  on us.user_profile_id = up.id;

create or replace view public.view_reactions_public
as
select
  rx.id,
  rx.blip_id,
  rx.user_profile_id,
  rx.emoji,
  rx.created_at,
  vpu.user_id,
  vpu.display_name
from public.reactions rx
join public.view_public_user vpu
  on vpu.profile_id = rx.user_profile_id;

grant select on public.view_public_user to anon, authenticated, service_role;
grant select on public.view_reactions_public to anon, authenticated, service_role;

drop policy if exists reactions_delete_own_authenticated on public.reactions;
create policy reactions_delete_own_authenticated
on public.reactions
for delete
to authenticated
using (
  exists (
    select 1
    from public.view_user vu
    where vu.profile_id = reactions.user_profile_id
  )
  and app_security.session_is_valid()
);

drop policy if exists reactions_insert_own_authenticated on public.reactions;
create policy reactions_insert_own_authenticated
on public.reactions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.view_user vu
    where vu.profile_id = reactions.user_profile_id
      and vu.status <> 'locked'::public.visitor_status
  )
  and app_security.session_is_valid()
);

drop policy if exists reactions_select_active_public on public.reactions;
create policy reactions_select_active_public
on public.reactions
for select
to authenticated, anon
using (
  exists (
    select 1
    from public.view_public_user vpu
    where vpu.profile_id = reactions.user_profile_id
      and vpu.status = 'active'::public.visitor_status
  )
);

drop policy if exists reactions_select_own_authenticated on public.reactions;
create policy reactions_select_own_authenticated
on public.reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.view_user vu
    where vu.profile_id = reactions.user_profile_id
  )
  and app_security.session_is_valid()
);

drop view if exists public.view_blips;
create view public.view_blips
with (security_invoker = true) as
with root_tags as (
  select
    bt.blip_id,
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'description', t.description
      )
      order by t.name
    ) as tags
  from public.blip_tags bt
  join public.tags t
    on t.id = bt.tag_id
  group by bt.blip_id
),
visible_reactions as (
  select
    rx.blip_id,
    rx.emoji,
    vpu.user_id as reactor_user_id,
    vpu.display_name
  from public.reactions rx
  join public.view_public_user vpu
    on vpu.profile_id = rx.user_profile_id
  where (
    vpu.status = 'active'::public.visitor_status
    or (auth.uid() is not null and vpu.user_id = auth.uid())
  )
),
reaction_groups as (
  select
    vr.blip_id,
    vr.emoji,
    count(*)::integer as count,
    bool_or(vr.reactor_user_id = auth.uid()) as reacted_by_current_user,
    case
      when auth.uid() is null then '[]'::jsonb
      else jsonb_agg(vr.display_name order by vr.display_name)
    end as display_names
  from visible_reactions vr
  group by vr.blip_id, vr.emoji
),
reaction_totals as (
  select
    vr.blip_id,
    count(*)::integer as reactions_count,
    count(*) filter (where vr.reactor_user_id = auth.uid())::integer as my_reaction_count
  from visible_reactions vr
  group by vr.blip_id
),
reaction_data as (
  select
    rg.blip_id,
    coalesce(rt.reactions_count, 0) as reactions_count,
    coalesce(rt.my_reaction_count, 0) as my_reaction_count,
    jsonb_agg(
      jsonb_build_object(
        'emoji', rg.emoji,
        'count', rg.count,
        'reacted_by_current_user', rg.reacted_by_current_user,
        'display_names', coalesce(rg.display_names, '[]'::jsonb)
      )
      order by rg.emoji
    ) as reactions
  from reaction_groups rg
  join reaction_totals rt
    on rt.blip_id = rg.blip_id
  group by rg.blip_id, rt.reactions_count, rt.my_reaction_count
),
visible_comments as (
  select
    c.id,
    c.parent_id,
    c.user_id,
    c.title,
    c.content,
    c.published,
    c.moderation_status,
    c.created_at,
    c.updated_at,
    c.blip_type,
    c.allow_comments,
    vpu.profile_id as author_profile_id,
    vpu.display_name as author_display_name,
    vpu.avatar_seed as author_avatar_seed,
    vpu.avatar_version as author_avatar_version
  from public.blips c
  left join public.view_public_user vpu
    on vpu.user_id = c.user_id
  where c.blip_type = 'comment'
    and (
      c.published is true
      or (
        auth.uid() is not null
        and c.user_id = auth.uid()
      )
      or (
        public.is_admin()
        and app_security.session_is_valid()
      )
    )
),
comments_by_parent as (
  select
    vc.parent_id,
    jsonb_agg(
      jsonb_build_object(
        'id', vc.id,
        'parent_id', vc.parent_id,
        'user_id', vc.user_id,
        'title', vc.title,
        'content', vc.content,
        'published', vc.published,
        'moderation_status', vc.moderation_status,
        'created_at', vc.created_at,
        'updated_at', vc.updated_at,
        'blip_type', vc.blip_type,
        'allow_comments', vc.allow_comments,
        'author', jsonb_build_object(
          'profile_id', vc.author_profile_id,
          'display_name', vc.author_display_name,
          'avatar_seed', vc.author_avatar_seed,
          'avatar_version', vc.author_avatar_version
        )
      )
      order by vc.created_at asc
    ) as comments
  from visible_comments vc
  group by vc.parent_id
),
updates_by_root as (
  select
    u.parent_id::text as root_id,
    count(*)::integer as updates_count,
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'parent_id', u.parent_id,
        'user_id', u.user_id,
        'title', u.title,
        'content', u.content,
        'published', u.published,
        'moderation_status', u.moderation_status,
        'created_at', u.created_at,
        'updated_at', u.updated_at,
        'blip_type', u.blip_type,
        'allow_comments', u.allow_comments,
        'reactions_count', coalesce(urd.reactions_count, 0),
        'my_reaction_count', coalesce(urd.my_reaction_count, 0),
        'reactions', coalesce(urd.reactions, '[]'::jsonb),
        'comments', coalesce(cbp.comments, '[]'::jsonb)
      )
      order by u.created_at desc
    ) as updates
  from public.blips u
  left join reaction_data urd
    on urd.blip_id = u.id::text
  left join comments_by_parent cbp
    on cbp.parent_id = u.id
  where u.blip_type = 'update'
  group by u.parent_id
)
select
  r.id,
  r.parent_id,
  r.user_id,
  r.title,
  r.content,
  r.published,
  r.moderation_status,
  r.created_at,
  r.updated_at,
  r.blip_type,
  r.allow_comments,
  coalesce(rt.tags, '[]'::jsonb) as tags,
  coalesce(ubr.updates_count, 0) as updates_count,
  coalesce(ubr.updates, '[]'::jsonb) as updates,
  coalesce(rd.reactions_count, 0) as reactions_count,
  coalesce(rd.my_reaction_count, 0) as my_reaction_count,
  coalesce(rd.reactions, '[]'::jsonb) as reactions,
  coalesce(cbp.comments, '[]'::jsonb) as comments
from public.blips r
left join root_tags rt
  on rt.blip_id = r.id::text
left join updates_by_root ubr
  on ubr.root_id = r.id::text
left join reaction_data rd
  on rd.blip_id = r.id::text
left join comments_by_parent cbp
  on cbp.parent_id = r.id
where r.parent_id is null
  and r.blip_type = 'root';

grant select on public.view_blips to anon, authenticated, service_role;
