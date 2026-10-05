-- Readable blip URLs: /blips/{id}/{slug}
--
-- * Adds a nullable `slug` column to public.blips.
-- * Adds SQL mirrors of the app's slug helpers (src/modules/blips/slug.ts):
--     public.normalize_blip_slug(text, int)              -- normalize text to a slug
--     public.blip_slug_source(title, content) -- title / heading / 1st sentence
--     public.derive_blip_slug(title, content) -- slug or NULL when empty
--   Keep these in lockstep with the TypeScript implementation.
-- * Backfills slugs for existing root blips (updates/comments are not
--   addressable by URL and keep slug = NULL).
-- * Adds a BEFORE INSERT OR UPDATE trigger: a provided slug is normalized;
--   a NULL/blank slug on a root blip is derived from title/content. Existing
--   slugs are never recalculated when the blip text changes.
-- * Re-exposes view_blips with the new `slug` column appended (create or
--   replace keeps the existing columns, grants and security_invoker setting).
--
-- Slugs are intentionally NOT unique: the id is always part of the URL.
-- `unaccent` is not installed on this project, so accents are stripped with
-- normalize(..., NFKD) + removal of combining marks (same as the app).
-- An empty slug (e.g. media-only blip) is stored as NULL and the blip is
-- linked as /blips/{id}.

alter table public.blips
  add column if not exists slug text;

comment on column public.blips.slug is
  'Readable URL slug for root blips (/blips/{id}/{slug}). Derived once from title/heading/first sentence; not unique; NULL means link by id only.';

create or replace function public.normalize_blip_slug(
  input text,
  max_length integer default 60
)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  with normalized as (
    select
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(
              regexp_replace(regexp_replace(regexp_replace(regexp_replace(
              regexp_replace(regexp_replace(regexp_replace(
                regexp_replace(
                  normalize(coalesce(input, ''), NFKD),
                  '[\u0300-\u036f]', '', 'g'
                ),
                'ß', 'ss', 'g'),
                '[æÆ]', 'ae', 'g'),
                '[œŒ]', 'oe', 'g'),
                '[øØ]', 'o', 'g'),
                '[đĐ]', 'd', 'g'),
                '[łŁ]', 'l', 'g'),
                '[þÞ]', 'th', 'g')
            ),
            '[''’‘`]', '', 'g'
          ),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ) as value
  )
  select
    case
      when length(value) <= max_length then value
      -- Hard max, cut at whole words: the longest prefix of at most
      -- max_length characters that is followed by a dash. Only a single
      -- first word longer than max_length is hard-cut.
      else regexp_replace(
        coalesce(
          substring(value from '^(.{1,' || max_length || '})-'),
          left(value, max_length)
        ),
        '-+$', ''
      )
    end
  from normalized
$$;

comment on function public.normalize_blip_slug(text, integer) is
  'URL slug normalization; mirrors normalizeBlipSlug() in src/modules/blips/slug.ts';

create or replace function public.blip_slug_source(
  title text,
  content text
)
returns text
language plpgsql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
declare
  cleaned text;
  heading text;
  line text;
begin
  if title is not null and public.normalize_blip_slug(title) <> '' then
    return title;
  end if;

  cleaned := coalesce(content, '');
  -- fenced code blocks
  cleaned := regexp_replace(cleaned, '```[^`]*```', ' ', 'g');
  -- custom embeds: {audio:{...}}, {media:{...}}
  cleaned := regexp_replace(cleaned, '\{[a-z]+:\{[^}]*\}\}', ' ', 'gi');
  -- images
  cleaned := regexp_replace(cleaned, '!\[[^\]]*\]\([^)]*\)', ' ', 'g');
  -- links -> link text
  cleaned := regexp_replace(cleaned, '\[([^\]]*)\]\([^)]*\)', '\1', 'g');
  -- html tags
  cleaned := regexp_replace(cleaned, '<[^>]*>', ' ', 'g');
  -- bare urls
  cleaned := regexp_replace(cleaned, 'https?://[^\s)]+', ' ', 'g');

  heading := (regexp_match(cleaned, '^#{1,6}[ \t]+(.+)$', 'n'))[1];
  if heading is not null and public.normalize_blip_slug(heading) <> '' then
    return heading;
  end if;

  for line in
    select regexp_replace(
      t.l,
      '^[ \t]*(#{1,6}[ \t]+|>[ \t]?|[*+-][ \t]+|[0-9]+[.)][ \t]+)+',
      ''
    )
    from regexp_split_to_table(cleaned, '\r?\n') with ordinality as t(l, n)
    order by t.n
  loop
    if public.normalize_blip_slug(line) <> '' then
      -- first sentence: cut at the first . ! ? that ends the line or is
      -- followed by whitespace
      return regexp_replace(line, '[.!?]+(\s.*)?$', '');
    end if;
  end loop;

  return '';
end;
$$;

comment on function public.blip_slug_source(text, text) is
  'Slug source text for a blip; mirrors blipSlugSource() in src/modules/blips/slug.ts';

create or replace function public.derive_blip_slug(
  title text,
  content text
)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  select nullif(public.normalize_blip_slug(public.blip_slug_source(title, content)), '')
$$;

comment on function public.derive_blip_slug(text, text) is
  'Slug for a blip, or NULL when no readable slug exists; mirrors deriveBlipSlug() in src/modules/blips/slug.ts';

-- Backfill existing root blips. No trigger touches updated_at, so sitemap
-- lastmod values are unaffected.
update public.blips
set slug = public.derive_blip_slug(title, content)
where blip_type = 'root'
  and slug is null;

create or replace function public.set_blip_slug()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.blip_type is distinct from 'root' then
    return new;
  end if;

  if new.slug is not null then
    new.slug := nullif(public.normalize_blip_slug(new.slug), '');
  end if;

  if new.slug is null then
    new.slug := public.derive_blip_slug(new.title, new.content);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_blips_set_slug on public.blips;
create trigger trg_blips_set_slug
before insert or update on public.blips
for each row
execute function public.set_blip_slug();

-- view_blips: identical to 20260424113000_add_view_blips_sort_at.sql, with
-- r.slug appended as the last column (required by create or replace view).
create or replace view public.view_blips
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
    c.publish_at,
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
        'publish_at', vc.publish_at,
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
root_comment_totals as (
  select
    vc.parent_id::text as root_id,
    count(*)::integer as comments_count
  from visible_comments vc
  join public.blips p
    on p.id = vc.parent_id
  where p.parent_id is null
    and p.blip_type = 'root'
  group by vc.parent_id
),
update_comment_totals as (
  select
    u.parent_id::text as root_id,
    count(vc.id)::integer as comments_count
  from public.blips u
  left join visible_comments vc
    on vc.parent_id = u.id
  where u.blip_type = 'update'
  group by u.parent_id
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
        'publish_at', u.publish_at,
        'created_at', u.created_at,
        'updated_at', u.updated_at,
        'blip_type', u.blip_type,
        'allow_comments', u.allow_comments,
        'reactions_count', coalesce(urd.reactions_count, 0),
        'my_reaction_count', coalesce(urd.my_reaction_count, 0),
        'reactions', coalesce(urd.reactions, '[]'::jsonb),
        'comments', coalesce(cbp.comments, '[]'::jsonb)
      )
      order by coalesce(u.publish_at, u.created_at) desc, u.created_at desc
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
  r.publish_at,
  r.created_at,
  r.updated_at,
  r.blip_type,
  r.allow_comments,
  coalesce(rt.tags, '[]'::jsonb) as tags,
  coalesce(ubr.updates_count, 0) as updates_count,
  coalesce(
    rct.comments_count,
    0
  ) + coalesce(
    uct.comments_count,
    0
  ) as comments_count,
  coalesce(ubr.updates, '[]'::jsonb) as updates,
  coalesce(rd.reactions_count, 0) as reactions_count,
  coalesce(rd.my_reaction_count, 0) as my_reaction_count,
  coalesce(rd.reactions, '[]'::jsonb) as reactions,
  coalesce(cbp.comments, '[]'::jsonb) as comments,
  coalesce(r.publish_at, r.created_at) as sort_at,
  r.slug
from public.blips r
left join root_tags rt
  on rt.blip_id = r.id::text
left join updates_by_root ubr
  on ubr.root_id = r.id::text
left join root_comment_totals rct
  on rct.root_id = r.id::text
left join update_comment_totals uct
  on uct.root_id = r.id::text
left join reaction_data rd
  on rd.blip_id = r.id::text
left join comments_by_parent cbp
  on cbp.parent_id = r.id
where r.parent_id is null
  and r.blip_type = 'root';

grant select on public.view_blips to anon, authenticated, service_role;
