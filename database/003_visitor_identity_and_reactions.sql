-- ============================================================================
-- FILE: 003_visitor_identity_and_reactions.sql
-- PURPOSE:
--   Step 1 for Blips Visitor Identity + Reactions:
--   - create app role enum/table + helpers
--   - create visitor status enum
--   - create visitors table
--   - create reactions table
--   - enable RLS and create policies
--
-- RUN THIS:
--   Manually in Supabase SQL editor after 001/002 security scripts.
--
-- NOTES:
--   - App-level roles live in public.user_roles and are separate from auth.users.role.
--   - New auth users are automatically assigned app role = 'visitor' via trigger.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Enums: app_role + visitor_status
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role'
      and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('superuser', 'admin', 'visitor');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'visitor_status'
      and n.nspname = 'public'
  ) then
    create type public.visitor_status as enum ('pending', 'active', 'locked');
  end if;
end;
$$;

-- --------------------------------------------------------------------------
-- Table: user_roles
-- --------------------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.app_role not null default 'visitor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_roles_role_idx
  on public.user_roles(role);

create index if not exists user_roles_created_at_idx
  on public.user_roles(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_user_roles_updated_at on public.user_roles;
create trigger trg_user_roles_updated_at
before update on public.user_roles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'visitor')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_auth_users_default_role on auth.users;
create trigger trg_auth_users_default_role
after insert on auth.users
for each row execute function public.handle_new_auth_user_role();

insert into public.user_roles (user_id, role)
select u.id, 'visitor'::public.app_role
from auth.users u
left join public.user_roles ur on ur.user_id = u.id
where ur.user_id is null;

-- --------------------------------------------------------------------------
-- Role helper functions
-- --------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select ur.role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() in ('superuser', 'admin'), false)
$$;

create or replace function public.is_superuser()
returns boolean
language sql
stable
as $$
  select coalesce(public.current_user_role() = 'superuser', false)
$$;

-- --------------------------------------------------------------------------
-- Table: visitors
-- --------------------------------------------------------------------------
create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  status public.visitor_status not null default 'pending',
  failed_login_attempts integer not null default 0 check (failed_login_attempts >= 0),
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists visitors_status_idx
  on public.visitors(status);

create index if not exists visitors_created_at_idx
  on public.visitors(created_at desc);

-- --------------------------------------------------------------------------
-- Table: reactions
-- --------------------------------------------------------------------------
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  blip_id text not null references public.blips(id) on delete cascade,
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint reactions_blip_visitor_emoji_unique unique (blip_id, visitor_id, emoji)
);

create index if not exists reactions_blip_id_idx
  on public.reactions(blip_id);

create index if not exists reactions_visitor_id_idx
  on public.reactions(visitor_id);

create index if not exists reactions_created_at_idx
  on public.reactions(created_at desc);

-- --------------------------------------------------------------------------
-- RLS: user_roles
-- --------------------------------------------------------------------------
alter table public.user_roles enable row level security;

drop policy if exists user_roles_select_superuser_all on public.user_roles;
create policy user_roles_select_superuser_all
on public.user_roles
for select
to authenticated
using (
  public.is_superuser()
  and app_security.session_is_valid()
);

drop policy if exists user_roles_select_own_authenticated on public.user_roles;
create policy user_roles_select_own_authenticated
on public.user_roles
for select
to authenticated
using (
  user_id = auth.uid()
  and app_security.session_is_valid()
);

drop policy if exists user_roles_insert_superuser on public.user_roles;
create policy user_roles_insert_superuser
on public.user_roles
for insert
to authenticated
with check (
  public.is_superuser()
  and app_security.session_is_valid()
);

drop policy if exists user_roles_update_superuser on public.user_roles;
create policy user_roles_update_superuser
on public.user_roles
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

drop policy if exists user_roles_delete_superuser on public.user_roles;
create policy user_roles_delete_superuser
on public.user_roles
for delete
to authenticated
using (
  public.is_superuser()
  and app_security.session_is_valid()
);

-- --------------------------------------------------------------------------
-- RLS: visitors
-- --------------------------------------------------------------------------
alter table public.visitors enable row level security;

drop policy if exists visitors_select_admin_all on public.visitors;
create policy visitors_select_admin_all
on public.visitors
for select
to authenticated
using (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists visitors_insert_admin_all on public.visitors;
create policy visitors_insert_admin_all
on public.visitors
for insert
to authenticated
with check (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists visitors_update_admin_all on public.visitors;
create policy visitors_update_admin_all
on public.visitors
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

drop policy if exists visitors_delete_admin_all on public.visitors;
create policy visitors_delete_admin_all
on public.visitors
for delete
to authenticated
using (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists visitors_select_own_authenticated on public.visitors;
create policy visitors_select_own_authenticated
on public.visitors
for select
to authenticated
using (
  user_id = auth.uid()
  and app_security.session_is_valid()
);

drop policy if exists visitors_select_active_public on public.visitors;
create policy visitors_select_active_public
on public.visitors
for select
to anon, authenticated
using (
  status = 'active'
);

-- --------------------------------------------------------------------------
-- RLS: reactions
-- --------------------------------------------------------------------------
alter table public.reactions enable row level security;

drop policy if exists reactions_select_admin_all on public.reactions;
create policy reactions_select_admin_all
on public.reactions
for select
to authenticated
using (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists reactions_insert_admin_all on public.reactions;
create policy reactions_insert_admin_all
on public.reactions
for insert
to authenticated
with check (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists reactions_update_admin_all on public.reactions;
create policy reactions_update_admin_all
on public.reactions
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

drop policy if exists reactions_delete_admin_all on public.reactions;
create policy reactions_delete_admin_all
on public.reactions
for delete
to authenticated
using (
  public.is_admin()
  and app_security.session_is_valid()
);

drop policy if exists reactions_select_active_public on public.reactions;
create policy reactions_select_active_public
on public.reactions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.visitors v
    where v.id = reactions.visitor_id
      and v.status = 'active'
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
    from public.visitors v
    where v.id = reactions.visitor_id
      and v.user_id = auth.uid()
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
    from public.visitors v
    where v.id = reactions.visitor_id
      and v.user_id = auth.uid()
      and v.status <> 'locked'
  )
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
    from public.visitors v
    where v.id = reactions.visitor_id
      and v.user_id = auth.uid()
  )
  and app_security.session_is_valid()
);

-- --------------------------------------------------------------------------
-- View update: public.view_blips (Step 2)
-- --------------------------------------------------------------------------
create or replace view public.view_blips as
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
  coalesce(root_tags.tags, '[]'::jsonb) as tags,
  coalesce(upd.updates_count, 0) as updates_count,
  coalesce(upd.updates, '[]'::jsonb) as updates,
  coalesce(reaction_data.reactions_count, 0) as reactions_count,
  coalesce(reaction_data.my_reaction_count, 0) as my_reaction_count,
  coalesce(reaction_data.reactions, '[]'::jsonb) as reactions
from
  blips r
  left join lateral (
    select
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
    where
      bt.blip_id = r.id::text
  ) root_tags on true
  left join lateral (
    select
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
          'blip_type', u.blip_type
        )
        order by u.created_at desc
      ) filter (where u.id is not null) as updates
    from
      blips u
    where
      u.parent_id::text = r.id::text
      and u.blip_type = 'update'::text
  ) upd on true
  left join lateral (
    with visible_reactions as (
      select
        rx.emoji,
        v.user_id as reactor_user_id,
        v.display_name
      from
        public.reactions rx
        join public.visitors v on v.id = rx.visitor_id
      where
        rx.blip_id = r.id::text
        and (
          v.status = 'active'::public.visitor_status
          or (auth.uid() is not null and v.user_id = auth.uid())
        )
    ),
    reaction_groups as (
      select
        vr.emoji,
        count(*)::integer as count,
        bool_or(vr.reactor_user_id = auth.uid()) as reacted_by_current_user,
        jsonb_agg(vr.display_name order by vr.display_name) as display_names
      from visible_reactions vr
      group by vr.emoji
    )
    select
      coalesce((select sum(g.count) from reaction_groups g), 0)::integer as reactions_count,
      coalesce(
        (
          select count(*)::integer
          from visible_reactions vr
          where vr.reactor_user_id = auth.uid()
        ),
        0
      )::integer as my_reaction_count,
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'emoji', g.emoji,
              'count', g.count,
              'reacted_by_current_user', g.reacted_by_current_user,
              'display_names', coalesce(g.display_names, '[]'::jsonb)
            )
            order by g.emoji
          )
          from reaction_groups g
        ),
        '[]'::jsonb
      ) as reactions
  ) reaction_data on true
where
  r.parent_id is null
  and r.blip_type = 'root'::text;
