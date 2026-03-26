-- ============================================================================
-- FILE: 009_update_profile.sql
-- PURPOSE:
--   Allow authenticated visitors to update their own profile display name
--   through a narrowly scoped RPC without opening broader table update access.
-- ============================================================================

drop function if exists public.update_current_visitor_profile(text);

create or replace function public.update_profile(
  next_display_name text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_display_name text := nullif(trim(coalesce(next_display_name, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not app_security.session_is_valid() then
    raise exception 'Session is invalid';
  end if;

  if normalized_display_name is null then
    raise exception 'Display name is required';
  end if;

  update public.visitors
  set display_name = normalized_display_name
  where user_id = auth.uid();

  if not found then
    raise exception 'Visitor profile not found';
  end if;
end;
$$;

revoke all on function public.update_profile(text) from public;
grant execute on function public.update_profile(text) to authenticated;
