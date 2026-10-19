-- Site-wide settings as a JSONB key/value store.
--
-- First key: home.heroImageIds — the Unsplash photo slugs rotated on the
-- home page hero. Seeded with the three IDs that were previously hardcoded
-- in src/modules/home/sections/hero.tsx. Keep that fallback list in
-- src/modules/site-settings/home-hero-images.ts in sync with this seed.

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.site_settings is
  'Site-wide key/value settings. Values are JSON; keys are dotted paths such as home.heroImageIds.';

comment on column public.site_settings.key is
  'Stable setting identifier, e.g. home.heroImageIds';

comment on column public.site_settings.value is
  'JSON value for the setting. Shape is defined by the application for each key.';

comment on column public.site_settings.updated_by is
  'Auth user id of the last superuser who saved this setting, when known.';

create trigger trg_site_settings_set_updated_at
  before update on public.site_settings
  for each row
  execute function public.set_updated_at();

alter table public.site_settings enable row level security;

create policy site_settings_select_public
  on public.site_settings
  for select
  to anon, authenticated
  using (true);

create policy site_settings_insert_superuser
  on public.site_settings
  for insert
  to authenticated
  with check (public.is_superuser() and app_security.session_is_valid());

create policy site_settings_update_superuser
  on public.site_settings
  for update
  to authenticated
  using (public.is_superuser() and app_security.session_is_valid())
  with check (public.is_superuser() and app_security.session_is_valid());

create policy site_settings_delete_superuser
  on public.site_settings
  for delete
  to authenticated
  using (public.is_superuser() and app_security.session_is_valid());

grant select on table public.site_settings to anon, authenticated;
grant all on table public.site_settings to service_role;

insert into public.site_settings (key, value)
values (
  'home.heroImageIds',
  '[
    "green-trees-with-mountain-on-the-horizon-high-angle-photography-dtxihV-sX8k",
    "green-forest-near-mountain-2z2CGEB7FIk",
    "a-mountain-with-lots-of-trees-in-the-foreground-TIQZu0mm4NQ"
  ]'::jsonb
);
