-- ============================================================================
-- FILE: 002_blips_policies.sql
-- PURPOSE:
--   Apply RLS policies for `public.blips` that require:
--   1) row ownership (auth.uid() = user_id), and
--   2) a valid server-side session (app_security.session_is_valid()).
--
-- PREREQUISITE:
--   - Run `001_app_security_core.sql` first.
--
-- SAFETY / DESTRUCTIVE NOTES:
--   - Drops/recreates only the named blips policies in this file.
--   - Does not drop tables or delete table row data.
--   - May replace existing policy behavior for those same policy names.
--
-- RERUN BEHAVIOR:
--   - Safe to rerun; result is deterministic for these policy names.
-- ============================================================================

alter table public.blips enable row level security;

drop policy if exists blips_insert_owner_valid_session on public.blips;
create policy blips_insert_owner_valid_session
on public.blips
for insert
to authenticated
with check (
  auth.uid() = user_id
  and app_security.session_is_valid()
);

drop policy if exists blips_update_owner_valid_session on public.blips;
create policy blips_update_owner_valid_session
on public.blips
for update
to authenticated
using (
  auth.uid() = user_id
  and app_security.session_is_valid()
)
with check (
  auth.uid() = user_id
  and app_security.session_is_valid()
);

drop policy if exists blips_delete_owner_valid_session on public.blips;
create policy blips_delete_owner_valid_session
on public.blips
for delete
to authenticated
using (
  auth.uid() = user_id
  and app_security.session_is_valid()
);
