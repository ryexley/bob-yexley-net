-- ============================================================================
-- FILE: 006_backfill_missing_visitor_profiles.sql
-- PURPOSE:
--   Ensure all existing auth users have a matching visitor profile so reactions
--   and other visitor-attributed interactions work for admins/superusers too.
-- ============================================================================

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
left join public.visitors v on v.user_id = u.id
where v.user_id is null;
