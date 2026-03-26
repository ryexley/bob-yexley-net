-- ============================================================================
-- FILE: 001_app_security_core.sql
-- PURPOSE:
--   Bootstrap all server-side session security objects for this project.
--
-- RUN THIS:
--   Once for initial setup, or intentionally when resetting this layer.
--
-- DESTRUCTIVE BEHAVIOR:
--   - Drops `app_security` schema with CASCADE.
--   - Recreates schema, table, functions, trigger, grants, and public RPC wrappers.
--   - Deletes all existing rows in `app_security.user_sessions` by recreation.
--
-- OUTPUT OBJECTS:
--   - app_security.user_sessions
--   - app_security.current_session_id()
--   - app_security.start_session(interval)
--   - app_security.revoke_current_session()
--   - app_security.session_is_valid(interval)
--   - app_security.revoke_all_user_sessions(uuid)
--   - app_security.cleanup_old_sessions(interval)
--   - public.start_session(interval)
--   - public.revoke_current_session()
--   - public.session_is_valid(interval)
--   - public.cleanup_old_sessions(interval)
--
-- NOTES:
--   - `current_session_id()` uses JWT session_id when present, otherwise
--     a deterministic fallback derived from auth.uid() + JWT iat.
--   - Public wrappers exist so Supabase client RPC calls can target exposed schema.
-- ============================================================================

drop function if exists public.start_session(interval);
drop function if exists public.revoke_current_session();
drop function if exists public.session_is_valid(interval);

drop schema if exists app_security cascade;
create schema app_security;

create table app_security.user_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_sessions_user_id_idx
  on app_security.user_sessions(user_id);

create index user_sessions_expires_at_idx
  on app_security.user_sessions(expires_at);

create function app_security.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_user_sessions_updated_at
before update on app_security.user_sessions
for each row execute function app_security.set_updated_at();

create function app_security.current_session_id()
returns uuid
language sql
stable
as $$
  with jwt as (
    select
      auth.jwt() ->> 'session_id' as sid,
      auth.uid()::text || ':' || coalesce(auth.jwt() ->> 'iat', '0') as seed
  ),
  hashed as (
    select sid, md5(seed) as h
    from jwt
  )
  select case
    when sid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then sid::uuid
    else (
      substr(h, 1, 8) || '-' ||
      substr(h, 9, 4) || '-' ||
      substr(h, 13, 4) || '-' ||
      substr(h, 17, 4) || '-' ||
      substr(h, 21, 12)
    )::uuid
  end
  from hashed
$$;

create function app_security.start_session(
  ttl interval default interval '7 days'
)
returns void
language plpgsql
security definer
set search_path = app_security, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := app_security.current_session_id();
begin
  if v_user_id is null or v_session_id is null then
    raise exception 'Missing auth context (user/session)';
  end if;

  insert into app_security.user_sessions(
    session_id,
    user_id,
    started_at,
    expires_at,
    revoked_at
  )
  values (
    v_session_id,
    v_user_id,
    now(),
    now() + ttl,
    null
  )
  on conflict (session_id) do nothing;
end;
$$;

create function app_security.revoke_current_session()
returns void
language plpgsql
security definer
set search_path = app_security, public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := app_security.current_session_id();
begin
  if v_user_id is null or v_session_id is null then
    return;
  end if;

  update app_security.user_sessions
  set revoked_at = now()
  where session_id = v_session_id
    and user_id = v_user_id
    and revoked_at is null;
end;
$$;

create function app_security.session_is_valid(
  max_age interval default interval '7 days'
)
returns boolean
language sql
stable
security definer
set search_path = app_security, public, auth
as $$
  select exists (
    select 1
    from app_security.user_sessions s
    where s.session_id = app_security.current_session_id()
      and s.user_id = auth.uid()
      and s.revoked_at is null
      and s.expires_at > now()
      and s.started_at >= now() - max_age
  )
$$;

create function app_security.revoke_all_user_sessions(
  target_user_id uuid default auth.uid()
)
returns integer
language plpgsql
security definer
set search_path = app_security, public, auth
as $$
declare
  affected_count integer := 0;
begin
  if target_user_id is null then
    return 0;
  end if;

  update app_security.user_sessions
  set revoked_at = now()
  where user_id = target_user_id
    and revoked_at is null;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

create function app_security.cleanup_old_sessions(
  retention interval default interval '30 days'
)
returns integer
language plpgsql
security definer
set search_path = app_security, public, auth
as $$
declare
  deleted_count integer := 0;
begin
  delete from app_security.user_sessions
  where
    (revoked_at is not null and revoked_at < now() - retention)
    or
    (expires_at < now() and expires_at < now() - retention);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant usage on schema app_security to authenticated;
grant execute on function app_security.start_session(interval) to authenticated;
grant execute on function app_security.revoke_current_session() to authenticated;
grant execute on function app_security.session_is_valid(interval) to authenticated;
grant execute on function app_security.revoke_all_user_sessions(uuid) to authenticated;
grant execute on function app_security.cleanup_old_sessions(interval) to authenticated;

create function public.start_session(
  ttl interval default interval '7 days'
)
returns void
language sql
security definer
set search_path = app_security, public, auth
as $$
  select app_security.start_session(ttl)
$$;

create function public.revoke_current_session()
returns void
language sql
security definer
set search_path = app_security, public, auth
as $$
  select app_security.revoke_current_session()
$$;

create function public.session_is_valid(
  max_age interval default interval '7 days'
)
returns boolean
language sql
stable
security definer
set search_path = app_security, public, auth
as $$
  select app_security.session_is_valid(max_age)
$$;

create function public.cleanup_old_sessions(
  retention interval default interval '30 days'
)
returns integer
language sql
security definer
set search_path = app_security, public, auth
as $$
  select app_security.cleanup_old_sessions(retention)
$$;

grant execute on function public.start_session(interval) to authenticated;
grant execute on function public.revoke_current_session() to authenticated;
grant execute on function public.session_is_valid(interval) to authenticated;
grant execute on function public.cleanup_old_sessions(interval) to authenticated;
