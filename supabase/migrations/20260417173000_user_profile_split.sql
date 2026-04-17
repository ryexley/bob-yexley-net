set check_function_bodies = off;

drop view if exists public.view_blips;
drop view if exists public.view_user;

create table if not exists public.user_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_seed text not null default encode(gen_random_bytes(16), 'hex'),
  avatar_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profile_avatar_version_check check (avatar_version > 0)
);

create table if not exists public.user_system (
  user_profile_id uuid primary key references public.user_profile (id) on delete cascade,
  status public.visitor_status not null default 'pending'::public.visitor_status,
  failed_login_attempts integer not null default 0,
  trusted boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_system_failed_login_attempts_check check (failed_login_attempts >= 0)
);

create index if not exists user_profile_created_at_idx
  on public.user_profile (created_at desc);

create index if not exists user_system_status_idx
  on public.user_system (status);

create index if not exists user_system_trusted_idx
  on public.user_system (trusted);

insert into public.user_profile (
  id,
  user_id,
  display_name,
  avatar_seed,
  avatar_version,
  created_at,
  updated_at
)
select
  coalesce(v.id, gen_random_uuid()),
  u.id,
  coalesce(
    nullif(trim(v.display_name), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'visitor'
  ),
  coalesce(v.avatar_seed, encode(gen_random_bytes(16), 'hex')),
  coalesce(v.avatar_version, 1),
  coalesce(v.created_at, now()),
  coalesce(v.created_at, now())
from auth.users u
left join public.visitors v
  on v.user_id = u.id
on conflict (user_id) do nothing;

insert into public.user_system (
  user_profile_id,
  status,
  failed_login_attempts,
  trusted,
  notes,
  created_at,
  updated_at
)
select
  up.id,
  coalesce(v.status, 'pending'::public.visitor_status),
  coalesce(v.failed_login_attempts, 0),
  case
    when coalesce(ur.role in ('admin', 'superuser'), false) then true
    else coalesce(v.trusted, false)
  end,
  v.notes,
  coalesce(v.created_at, now()),
  coalesce(v.created_at, now())
from public.user_profile up
left join public.visitors v
  on v.user_id = up.user_id
left join public.user_roles ur
  on ur.user_id = up.user_id
on conflict (user_profile_id) do nothing;

drop trigger if exists trg_user_profile_updated_at on public.user_profile;
create trigger trg_user_profile_updated_at
before update on public.user_profile
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_system_updated_at on public.user_system;
create trigger trg_user_system_updated_at
before update on public.user_system
for each row
execute function public.set_updated_at();

alter table public.reactions
  drop constraint if exists reactions_blip_visitor_emoji_unique;

alter table public.reactions
  drop constraint if exists reactions_visitor_id_fkey;

alter table public.reactions
  rename column visitor_id to user_profile_id;

alter index if exists public.reactions_visitor_id_idx
  rename to reactions_user_profile_id_idx;

alter table public.reactions
  add constraint reactions_blip_user_profile_emoji_unique
  unique (blip_id, user_profile_id, emoji);

alter table public.reactions
  add constraint reactions_user_profile_id_fkey
  foreign key (user_profile_id)
  references public.user_profile (id)
  on delete cascade;

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_display_name text;
  v_role public.app_role;
  v_user_profile_id uuid;
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

  insert into public.user_profile (
    user_id,
    display_name
  )
  values (
    new.id,
    v_display_name
  )
  on conflict (user_id) do update
    set display_name = coalesce(public.user_profile.display_name, excluded.display_name)
  returning id into v_user_profile_id;

  insert into public.user_system (
    user_profile_id,
    status,
    failed_login_attempts,
    trusted
  )
  values (
    v_user_profile_id,
    'pending'::public.visitor_status,
    0,
    coalesce(v_role in ('admin', 'superuser'), false)
  )
  on conflict (user_profile_id) do nothing;

  return new;
end;
$$;

create or replace function public.sync_user_system_trust_from_role()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.role in ('admin', 'superuser') then
    update public.user_system us
    set trusted = true
    from public.user_profile up
    where up.id = us.user_profile_id
      and up.user_id = new.user_id
      and us.trusted is distinct from true;
  end if;

  return new;
end;
$$;

create or replace function public.record_failed_visitor_login_attempt(
  target_email text,
  max_attempts integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  v_user_id uuid;
  v_user_profile_id uuid;
  v_failed_attempts integer := 0;
  v_locked boolean := false;
  v_display_name text;
begin
  if normalized_email = '' then
    return jsonb_build_object('found', false, 'locked', false, 'failed_attempts', 0);
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('found', false, 'locked', false, 'failed_attempts', 0);
  end if;

  select up.id
  into v_user_profile_id
  from public.user_profile up
  where up.user_id = v_user_id
  limit 1;

  if v_user_profile_id is null then
    v_display_name := coalesce(nullif(split_part(normalized_email, '@', 1), ''), 'visitor');

    insert into public.user_profile (
      user_id,
      display_name
    )
    values (
      v_user_id,
      v_display_name
    )
    returning id into v_user_profile_id;

    insert into public.user_system (
      user_profile_id,
      status,
      failed_login_attempts
    )
    values (
      v_user_profile_id,
      case
        when greatest(max_attempts, 1) <= 1 then 'locked'::public.visitor_status
        else 'pending'::public.visitor_status
      end,
      1
    )
    returning
      failed_login_attempts,
      (status = 'locked'::public.visitor_status)
    into
      v_failed_attempts,
      v_locked;

    return jsonb_build_object(
      'found', true,
      'locked', v_locked,
      'failed_attempts', v_failed_attempts
    );
  end if;

  update public.user_system us
  set
    failed_login_attempts = us.failed_login_attempts + 1,
    status = case
      when us.failed_login_attempts + 1 >= greatest(max_attempts, 1)
        then 'locked'::public.visitor_status
      else us.status
    end
  where us.user_profile_id = v_user_profile_id
  returning
    us.failed_login_attempts,
    (us.status = 'locked'::public.visitor_status)
  into
    v_failed_attempts,
    v_locked;

  return jsonb_build_object(
    'found', true,
    'locked', v_locked,
    'failed_attempts', v_failed_attempts
  );
end;
$$;

create or replace function public.sync_visitor_state()
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.user_system us
  set failed_login_attempts = 0
  from public.user_profile up
  where up.id = us.user_profile_id
    and up.user_id = auth.uid()
    and us.failed_login_attempts <> 0;
end;
$$;

create or replace function public.enforce_comment_blip_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_parent public.blips%rowtype;
  v_status public.visitor_status;
  v_trusted boolean := false;
  v_role public.app_role;
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
    us.status,
    us.trusted,
    ur.role
  into
    v_status,
    v_trusted,
    v_role
  from public.user_profile up
  join public.user_system us
    on us.user_profile_id = up.id
  left join public.user_roles ur
    on ur.user_id = up.user_id
  where up.user_id = new.user_id
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_status = 'locked' then
    raise exception 'Locked users cannot comment';
  end if;

  if tg_op = 'INSERT' then
    if v_status = 'active' and (coalesce(v_trusted, false) or coalesce(v_role in ('admin', 'superuser'), false)) then
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

drop trigger if exists trg_auth_users_create_visitor_profile on auth.users;
drop trigger if exists trg_auth_users_create_user_profile on auth.users;
create trigger trg_auth_users_create_user_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user_profile();

drop trigger if exists trg_user_roles_sync_trusted on public.user_roles;
drop trigger if exists trg_user_roles_sync_user_system_trusted on public.user_roles;
create trigger trg_user_roles_sync_user_system_trusted
after insert or update of role on public.user_roles
for each row
execute function public.sync_user_system_trust_from_role();

update public.user_system us
set trusted = true
from public.user_profile up
join public.user_roles ur
  on ur.user_id = up.user_id
where up.id = us.user_profile_id
  and ur.role in ('admin', 'superuser')
  and us.trusted is distinct from true;

alter table public.user_profile enable row level security;
alter table public.user_system enable row level security;

drop policy if exists user_profile_select_visible on public.user_profile;
create policy user_profile_select_visible
on public.user_profile
for select
to authenticated, anon
using (
  exists (
    select 1
    from public.user_system us
    where us.user_profile_id = user_profile.id
      and us.status = 'active'::public.visitor_status
  )
  or (
    auth.role() = 'authenticated'
    and user_id = auth.uid()
    and app_security.session_is_valid()
  )
  or (
    public.is_admin()
    and app_security.session_is_valid()
  )
);

drop policy if exists user_profile_update_own_authenticated on public.user_profile;
create policy user_profile_update_own_authenticated
on public.user_profile
for update
to authenticated
using (
  user_id = auth.uid()
  and app_security.session_is_valid()
)
with check (
  user_id = auth.uid()
  and app_security.session_is_valid()
);

drop policy if exists user_system_select_own_authenticated on public.user_system;
create policy user_system_select_own_authenticated
on public.user_system
for select
to authenticated
using (
  exists (
    select 1
    from public.user_profile up
    where up.id = user_system.user_profile_id
      and up.user_id = auth.uid()
      and app_security.session_is_valid()
  )
);

drop policy if exists user_system_select_admin_all on public.user_system;
create policy user_system_select_admin_all
on public.user_system
for select
to authenticated
using (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists user_system_update_admin_all on public.user_system;
create policy user_system_update_admin_all
on public.user_system
for update
to authenticated
using (
  public.is_admin()
  and app_security.session_is_valid()
)
with check (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists user_system_insert_admin_all on public.user_system;
create policy user_system_insert_admin_all
on public.user_system
for insert
to authenticated
with check (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists user_system_delete_admin_all on public.user_system;
create policy user_system_delete_admin_all
on public.user_system
for delete
to authenticated
using (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists reactions_delete_own_authenticated on public.reactions;
create policy reactions_delete_own_authenticated
on public.reactions
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_profile up
    where up.id = reactions.user_profile_id
      and up.user_id = auth.uid()
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
    from public.user_profile up
    join public.user_system us
      on us.user_profile_id = up.id
    where up.id = reactions.user_profile_id
      and up.user_id = auth.uid()
      and us.status <> 'locked'::public.visitor_status
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
    from public.user_profile up
    join public.user_system us
      on us.user_profile_id = up.id
    where up.id = reactions.user_profile_id
      and us.status = 'active'::public.visitor_status
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
    from public.user_profile up
    where up.id = reactions.user_profile_id
      and up.user_id = auth.uid()
  )
  and app_security.session_is_valid()
);

create view public.view_user
with (security_invoker = true) as
select
  up.user_id,
  coalesce(ur.role, 'visitor'::public.app_role) as role,
  ur.created_at as role_created_at,
  ur.updated_at as role_updated_at,
  up.id as profile_id,
  up.display_name,
  us.status,
  us.failed_login_attempts,
  us.notes,
  us.trusted,
  up.avatar_seed,
  up.avatar_version,
  up.created_at as profile_created_at,
  up.updated_at as profile_updated_at,
  us.created_at as system_created_at,
  us.updated_at as system_updated_at
from public.user_profile up
left join public.user_roles ur
  on ur.user_id = up.user_id
left join public.user_system us
  on us.user_profile_id = up.id
where up.user_id = auth.uid();

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
    up.user_id as reactor_user_id,
    up.display_name
  from public.reactions rx
  join public.user_profile up
    on up.id = rx.user_profile_id
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
    up.id as author_profile_id,
    up.display_name as author_display_name,
    up.avatar_seed as author_avatar_seed,
    up.avatar_version as author_avatar_version
  from public.blips c
  left join public.user_profile up
    on up.user_id = c.user_id
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

grant select on public.user_profile to anon, authenticated, service_role;
grant update on public.user_profile to authenticated, service_role;
grant all on public.user_profile to service_role;

grant select on public.user_system to authenticated, service_role;
grant update on public.user_system to authenticated, service_role;
grant all on public.user_system to service_role;

grant select on public.view_user to authenticated, service_role;
grant select on public.view_blips to anon, authenticated, service_role;

drop function if exists public.handle_new_auth_visitor_profile();
drop function if exists public.sync_visitor_trust_from_role();
drop function if exists public.update_profile(text);
drop function if exists public.update_avatar_version(integer);

drop table if exists public.visitors cascade;
