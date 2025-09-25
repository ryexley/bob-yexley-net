# Database Security Scripts

This folder contains one-time bootstrap SQL scripts for server-side session policy enforcement.

## Why this exists

Supabase free tier does not expose built-in max-session controls (time-box and inactivity timeout).  
To keep auth tighter than client-only local storage checks, these scripts add a reusable session policy layer in Postgres and wire it into RLS.

## Important

`001_app_security_core.sql` is destructive:

- it drops `app_security` schema (cascade),
- recreates all app security objects from scratch,
- and clears existing rows in `app_security.user_sessions`.

Use it as initial setup, or when intentionally resetting this security layer.
Do not run it casually in production unless you intend to reset this security layer.

## Files

- `001_app_security_core.sql`
  - Destructive bootstrap script that recreates:
    - `app_security` schema and `user_sessions` table
    - all security functions
    - public RPC wrappers
    - grants
  - Includes helper functions:
    - `app_security.current_session_id()`
    - `app_security.open_current_session(ttl interval default interval '7 days')`
    - `app_security.revoke_current_session()`
    - `app_security.session_is_valid(max_age interval default interval '7 days')`
    - `app_security.revoke_all_user_sessions(target_user_id uuid default auth.uid())`
    - `app_security.cleanup_old_sessions(retention interval default interval '30 days')`

- `002_blips_policies.sql`
  - Initial integration for `public.blips`.
  - Requires valid session and ownership (`auth.uid() = user_id`) for insert/update/delete.

## Run order

Execute scripts in this order:

1. `001_app_security_core.sql`
2. `002_blips_policies.sql`

## How to run

Use Supabase SQL Editor and run each script in order.

## What gets created

`001_app_security_core.sql` creates:

- table: `app_security.user_sessions`
- trigger: `trg_user_sessions_updated_at`
- functions in `app_security`:
  - `current_session_id()`
  - `open_current_session(interval)`
  - `revoke_current_session()`
  - `session_is_valid(interval)`
  - `cleanup_old_sessions(interval)`
  - `revoke_all_user_sessions(uuid)`
- wrapper RPC functions in `public`:
  - `open_current_session(interval)`
  - `revoke_current_session()`
  - `session_is_valid(interval)`

## App integration checklist

After running the SQL scripts, wire the app to open/revoke sessions:

1. On successful sign-in, call:
   - `rpc('open_current_session', { ttl: '7 days' })` (or default).
2. On logout/sign-out, call:
   - `rpc('revoke_current_session')`.
3. Keep client-side session checks as UX guardrails.
4. Treat RLS as the source of truth for authorization.

## Operational queries (manual)

Inspect recent sessions:

```sql
select *
from app_security.user_sessions
order by created_at desc
limit 50;
```

Delete expired or revoked sessions:

```sql
delete from app_security.user_sessions
where revoked_at is not null
   or expires_at <= now();
```

Run cleanup function directly:

```sql
select app_security.cleanup_old_sessions('30 days'::interval);
```

Revoke all sessions for one user:

```sql
select app_security.revoke_all_user_sessions('<user_uuid_here>'::uuid);
```

Force-expire newest active session (quick test):

```sql
with latest_active as (
  select session_id
  from app_security.user_sessions
  where revoked_at is null
  order by created_at desc
  limit 1
)
update app_security.user_sessions s
set expires_at = now() - interval '1 minute'
from latest_active la
where s.session_id = la.session_id;
```

## Design notes

- Missing session row should fail `session_is_valid()`.
- Policies should be generic and reusable across features.
- Add `app_security.session_is_valid()` to future protected tables.
- Prefer central policy logic over per-feature custom checks.
- RPC wrappers are in `public` so client `rpc()` calls work without exposing `app_security`.
