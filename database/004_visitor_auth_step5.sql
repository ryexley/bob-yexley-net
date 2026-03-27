-- ============================================================================
-- FILE: 004_visitor_auth_step5.sql
-- PURPOSE:
--   Step 5 for visitor auth:
--   - auto-create visitor profiles at auth user creation time
--   - server-side failed-login tracking + lockout updates
--   - reset failed-login attempts after successful auth
-- ============================================================================

-- --------------------------------------------------------------------------
-- Auto-create visitor profile on auth.users insert
-- --------------------------------------------------------------------------
create or replace function public.handle_new_auth_visitor_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_display_name text;
begin
  v_display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_display_name is null then
    v_display_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  if v_display_name is null then
    v_display_name := 'visitor';
  end if;

  insert into public.visitors (
    user_id,
    display_name,
    status,
    failed_login_attempts
  )
  values (
    new.id,
    v_display_name,
    'pending'::public.visitor_status,
    0
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_auth_users_create_visitor_profile on auth.users;
create trigger trg_auth_users_create_visitor_profile
after insert on auth.users
for each row execute function public.handle_new_auth_visitor_profile();

insert into public.visitors (user_id, display_name, status, failed_login_attempts)
select
  u.id,
  coalesce(
    nullif(trim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'visitor'
  ) as display_name,
  'pending'::public.visitor_status as status,
  0 as failed_login_attempts
from auth.users u
join public.user_roles ur on ur.user_id = u.id and ur.role = 'visitor'::public.app_role
left join public.visitors v on v.user_id = u.id
where v.user_id is null;

-- --------------------------------------------------------------------------
-- Failed visitor login tracking + lockout
-- --------------------------------------------------------------------------
create or replace function public.record_failed_visitor_login_attempt(
  target_email text,
  max_attempts integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  v_user_id uuid;
  v_failed_attempts integer := 0;
  v_locked boolean := false;
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

  update public.visitors v
  set
    failed_login_attempts = v.failed_login_attempts + 1,
    status = case
      when v.failed_login_attempts + 1 >= greatest(max_attempts, 1)
        then 'locked'::public.visitor_status
      else v.status
    end
  where v.user_id = v_user_id
  returning
    v.failed_login_attempts,
    (v.status = 'locked'::public.visitor_status)
  into
    v_failed_attempts,
    v_locked;

  if not found then
    insert into public.visitors (user_id, display_name, status, failed_login_attempts)
    values (
      v_user_id,
      coalesce(nullif(split_part(normalized_email, '@', 1), ''), 'visitor'),
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
  end if;

  return jsonb_build_object(
    'found', true,
    'locked', v_locked,
    'failed_attempts', v_failed_attempts
  );
end;
$$;

create or replace function public.reset_current_visitor_failed_login_attempts()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.visitors
  set failed_login_attempts = 0
  where user_id = auth.uid()
    and failed_login_attempts <> 0;
end;
$$;

revoke all on function public.record_failed_visitor_login_attempt(text, integer) from public;
grant execute on function public.record_failed_visitor_login_attempt(text, integer) to anon, authenticated;

revoke all on function public.reset_current_visitor_failed_login_attempts() from public;
grant execute on function public.reset_current_visitor_failed_login_attempts() to authenticated;
