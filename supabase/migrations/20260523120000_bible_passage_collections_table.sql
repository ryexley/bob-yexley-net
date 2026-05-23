create table public.bible_passage_collections (
  id integer generated always as identity (start with 1000 increment by 1) primary key,
  name varchar(64) not null,
  description varchar(256),
  slug varchar(96) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index bible_passage_collections_unique_name_idx
  on public.bible_passage_collections (name)
  where deleted_at is null;

create unique index bible_passage_collections_unique_slug_idx
  on public.bible_passage_collections (slug)
  where deleted_at is null;

create trigger trg_bible_passage_collections_set_updated_at
  before update on public.bible_passage_collections
  for each row
  execute function public.set_updated_at();

alter table public.bible_passage_collections enable row level security;

create policy bible_passage_collections_select_public
  on public.bible_passage_collections
  for select
  to anon, authenticated
  using (deleted_at is null);

create policy bible_passage_collections_select_admin
  on public.bible_passage_collections
  for select
  to authenticated
  using (public.is_admin() and app_security.session_is_valid());

create policy bible_passage_collections_insert_admin
  on public.bible_passage_collections
  for insert
  to authenticated
  with check (public.is_admin() and app_security.session_is_valid());

create policy bible_passage_collections_update_admin
  on public.bible_passage_collections
  for update
  to authenticated
  using (public.is_admin() and app_security.session_is_valid())
  with check (public.is_admin() and app_security.session_is_valid());

create policy bible_passage_collections_delete_admin
  on public.bible_passage_collections
  for delete
  to authenticated
  using (public.is_admin() and app_security.session_is_valid());

grant select on table public.bible_passage_collections to anon, authenticated;
grant all on table public.bible_passage_collections to service_role;

grant usage, select on sequence public.bible_passage_collections_id_seq to service_role;
