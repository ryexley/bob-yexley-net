set check_function_bodies = off;

alter table public.blips
  add column if not exists allow_comments boolean not null default true;

alter table public.visitors
  add column if not exists trusted boolean not null default false,
  add column if not exists avatar_seed text not null default encode(gen_random_bytes(16), 'hex'),
  add column if not exists avatar_version integer not null default 1;

alter table public.visitors
  drop constraint if exists visitors_avatar_version_check;

alter table public.visitors
  add constraint visitors_avatar_version_check check (avatar_version > 0);

create index if not exists blips_comments_parent_created_at_idx
  on public.blips (parent_id, created_at desc)
  where blip_type = 'comment';

create or replace function public.handle_new_auth_visitor_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_display_name text;
  v_role public.app_role;
begin
  v_display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_display_name is null then
    v_display_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  if v_display_name is null then
    v_display_name := 'visitor';
  end if;

  select ur.role
  into v_role
  from public.user_roles ur
  where ur.user_id = new.id
  limit 1;

  insert into public.visitors (
    user_id,
    display_name,
    status,
    failed_login_attempts,
    trusted
  )
  values (
    new.id,
    v_display_name,
    'pending'::public.visitor_status,
    0,
    coalesce(v_role in ('admin', 'superuser'), false)
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_visitor_trust_from_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.role in ('admin', 'superuser') then
    update public.visitors
    set trusted = true
    where user_id = new.user_id
      and trusted is distinct from true;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_user_roles_sync_trusted on public.user_roles;

create trigger trg_user_roles_sync_trusted
after insert or update of role on public.user_roles
for each row
execute function public.sync_visitor_trust_from_role();

update public.visitors v
set trusted = true
from public.user_roles ur
where ur.user_id = v.user_id
  and ur.role in ('admin', 'superuser')
  and v.trusted is distinct from true;

create or replace function public.enforce_comment_blip_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_parent public.blips%rowtype;
  v_visitor public.visitors%rowtype;
  v_role public.app_role;
  v_is_trusted boolean := false;
  v_visitor_id uuid;
  v_visitor_user_id uuid;
  v_visitor_display_name text;
  v_visitor_status public.visitor_status;
  v_visitor_failed_login_attempts integer;
  v_visitor_notes text;
  v_visitor_trusted boolean;
  v_visitor_avatar_seed text;
  v_visitor_avatar_version integer;
  v_visitor_created_at timestamptz;
begin
  if new.allow_comments is null then
    new.allow_comments := true;
  end if;

  if new.blip_type <> 'comment' then
    return new;
  end if;

  if new.parent_id is null then
    raise exception 'Comments require a parent blip';
  end if;

  select *
  into v_parent
  from public.blips
  where id = new.parent_id;

  if not found then
    raise exception 'Comment parent not found';
  end if;

  if v_parent.blip_type not in ('root', 'update') then
    raise exception 'Comments may only attach to root or update blips';
  end if;

  if tg_op = 'INSERT' and coalesce(v_parent.allow_comments, true) is not true then
    raise exception 'Comments are disabled for this blip';
  end if;

  if new.user_id is null then
    raise exception 'Comments require an authenticated author';
  end if;

  select
    v.id,
    v.user_id,
    v.display_name,
    v.status,
    v.failed_login_attempts,
    v.notes,
    v.trusted,
    v.avatar_seed,
    v.avatar_version,
    v.created_at,
    ur.role
  into
    v_visitor_id,
    v_visitor_user_id,
    v_visitor_display_name,
    v_visitor_status,
    v_visitor_failed_login_attempts,
    v_visitor_notes,
    v_visitor_trusted,
    v_visitor_avatar_seed,
    v_visitor_avatar_version,
    v_visitor_created_at,
    v_role
  from public.visitors v
  left join public.user_roles ur
    on ur.user_id = v.user_id
  where v.user_id = new.user_id
  limit 1;

  if not found then
    raise exception 'Visitor profile not found';
  end if;

  v_visitor.id := v_visitor_id;
  v_visitor.user_id := v_visitor_user_id;
  v_visitor.display_name := v_visitor_display_name;
  v_visitor.status := v_visitor_status;
  v_visitor.failed_login_attempts := v_visitor_failed_login_attempts;
  v_visitor.notes := v_visitor_notes;
  v_visitor.trusted := v_visitor_trusted;
  v_visitor.avatar_seed := v_visitor_avatar_seed;
  v_visitor.avatar_version := v_visitor_avatar_version;
  v_visitor.created_at := v_visitor_created_at;

  if v_visitor.status = 'locked' then
    raise exception 'Locked visitors cannot comment';
  end if;

  if tg_op = 'INSERT' then
    v_is_trusted := coalesce(v_visitor.trusted, false) or coalesce(v_role in ('admin', 'superuser'), false);
    if v_visitor.status = 'active' and v_is_trusted then
      new.published := true;
      new.moderation_status := 'approved';
    else
      new.published := false;
      new.moderation_status := 'pending';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_blips_enforce_comment_rules on public.blips;

create trigger trg_blips_enforce_comment_rules
before insert or update on public.blips
for each row
execute function public.enforce_comment_blip_rules();

drop policy if exists blips_select_admin_all on public.blips;
create policy blips_select_admin_all
on public.blips
for select
to authenticated
using (
  blip_type = 'comment'
  and
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists blips_update_superuser_all on public.blips;
create policy blips_update_superuser_all
on public.blips
for update
to authenticated
using (
  public.is_superuser()
  and app_security.session_is_valid()
)
with check (
  public.is_superuser()
  and app_security.session_is_valid()
);

drop policy if exists blips_delete_superuser_all on public.blips;
create policy blips_delete_superuser_all
on public.blips
for delete
to authenticated
using (
  public.is_superuser()
  and app_security.session_is_valid()
);

drop policy if exists blips_update_admin_comments on public.blips;
create policy blips_update_admin_comments
on public.blips
for update
to authenticated
using (
  blip_type = 'comment'
  and public.is_admin()
  and app_security.session_is_valid()
)
with check (
  blip_type = 'comment'
  and public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists blips_delete_admin_comments on public.blips;
create policy blips_delete_admin_comments
on public.blips
for delete
to authenticated
using (
  blip_type = 'comment'
  and public.is_admin()
  and app_security.session_is_valid()
);

drop view if exists public.view_user;

create view public.view_user
with (security_invoker = true) as
select
  ur.user_id,
  ur.role,
  ur.created_at as role_created_at,
  ur.updated_at as role_updated_at,
  v.id as visitor_id,
  v.display_name as visitor_display_name,
  v.status as visitor_status,
  v.failed_login_attempts as visitor_failed_login_attempts,
  v.notes as visitor_notes,
  v.trusted as visitor_trusted,
  v.avatar_seed as visitor_avatar_seed,
  v.avatar_version as visitor_avatar_version,
  v.created_at as visitor_created_at
from public.user_roles ur
left join public.visitors v
  on v.user_id = ur.user_id
where ur.user_id = auth.uid();

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
    v.user_id as reactor_user_id,
    v.display_name
  from public.reactions rx
  join public.visitors v
    on v.id = rx.visitor_id
  where (
    v.status = 'active'::public.visitor_status
    or (auth.uid() is not null and v.user_id = auth.uid())
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
    v.id as author_visitor_id,
    v.display_name as author_display_name,
    v.avatar_seed as author_avatar_seed,
    v.avatar_version as author_avatar_version
  from public.blips c
  left join public.visitors v
    on v.user_id = c.user_id
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
          'visitor_id', vc.author_visitor_id,
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
