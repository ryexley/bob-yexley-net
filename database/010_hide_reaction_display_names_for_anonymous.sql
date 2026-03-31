-- ============================================================================
-- FILE: 010_hide_reaction_display_names_for_anonymous.sql
-- PURPOSE:
--   Prevent anonymous clients from receiving reactor display names in
--   public.view_blips while preserving them for authenticated viewers.
-- ============================================================================

create or replace view public.view_blips as
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
  from
    blip_tags bt
    join tags t on t.id = bt.tag_id
  group by
    bt.blip_id
),
visible_reactions as (
  select
    rx.blip_id,
    rx.emoji,
    v.user_id as reactor_user_id,
    v.display_name
  from
    public.reactions rx
    join public.visitors v on v.id = rx.visitor_id
  where
    v.status = 'active'::public.visitor_status
    or (auth.uid() is not null and v.user_id = auth.uid())
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
  from
    visible_reactions vr
  group by
    vr.blip_id,
    vr.emoji
),
reaction_totals as (
  select
    vr.blip_id,
    count(*)::integer as reactions_count,
    count(*) filter (where vr.reactor_user_id = auth.uid())::integer as my_reaction_count
  from
    visible_reactions vr
  group by
    vr.blip_id
),
reaction_data as (
  select
    rg.blip_id,
    coalesce(rt.reactions_count, 0)::integer as reactions_count,
    coalesce(rt.my_reaction_count, 0)::integer as my_reaction_count,
    jsonb_agg(
      jsonb_build_object(
        'emoji', rg.emoji,
        'count', rg.count,
        'reacted_by_current_user', rg.reacted_by_current_user,
        'display_names', coalesce(rg.display_names, '[]'::jsonb)
      )
      order by rg.emoji
    ) as reactions
  from
    reaction_groups rg
    join reaction_totals rt on rt.blip_id = rg.blip_id
  group by
    rg.blip_id,
    rt.reactions_count,
    rt.my_reaction_count
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
        'reactions_count', coalesce(urd.reactions_count, 0),
        'my_reaction_count', coalesce(urd.my_reaction_count, 0),
        'reactions', coalesce(urd.reactions, '[]'::jsonb)
      )
      order by u.created_at desc
    ) as updates
  from
    blips u
    left join reaction_data urd on urd.blip_id = u.id::text
  where
    u.blip_type = 'update'::text
  group by
    u.parent_id
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
  coalesce(rt.tags, '[]'::jsonb) as tags,
  coalesce(ubr.updates_count, 0) as updates_count,
  coalesce(ubr.updates, '[]'::jsonb) as updates,
  coalesce(rd.reactions_count, 0) as reactions_count,
  coalesce(rd.my_reaction_count, 0) as my_reaction_count,
  coalesce(rd.reactions, '[]'::jsonb) as reactions
from
  blips r
  left join root_tags rt on rt.blip_id = r.id::text
  left join updates_by_root ubr on ubr.root_id = r.id::text
  left join reaction_data rd on rd.blip_id = r.id::text
where
  r.parent_id is null
  and r.blip_type = 'root'::text;

alter view public.view_blips set (security_invoker = true);
