-- ============================================================================
-- FILE: 005_current_user_profile_view.sql
-- PURPOSE:
--   Reduce auth-context query chatter by exposing one row that includes:
--   - current app role metadata
--   - current visitor profile metadata
--   - scoped to auth.uid() only
-- ============================================================================

drop view if exists public.view_current_user_profile;
drop view if exists public.view_user;

create or replace view public.view_current_user_profile as
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
  v.created_at as visitor_created_at
from public.user_roles ur
left join public.visitors v on v.user_id = ur.user_id
where ur.user_id = auth.uid();

-- Execute with caller privileges so RLS remains authoritative.
alter view public.view_current_user_profile set (security_invoker = true);

create or replace view public.view_user as
select *
from public.view_current_user_profile;

alter view public.view_user set (security_invoker = true);
