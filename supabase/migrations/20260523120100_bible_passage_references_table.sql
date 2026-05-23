create table public.bible_passage_references (
  id integer generated always as identity (start with 700 increment by 1) primary key,
  collection_id integer references public.bible_passage_collections (id) on delete cascade,
  book varchar(64) not null,
  chapter integer not null,
  start_verse integer not null,
  end_verse integer,
  slug varchar(96) not null,
  background_color_hex varchar(10),
  unsplash_image_id varchar(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint bible_passage_references_chapter_check check (chapter > 0),
  constraint bible_passage_references_start_verse_check check (start_verse > 0),
  constraint bible_passage_references_end_verse_check check (
    end_verse is null
    or end_verse >= start_verse
  )
);

create index bible_passage_references_collection_idx
  on public.bible_passage_references (collection_id);

create unique index bible_passage_references_unique_ref_idx
  on public.bible_passage_references (book, chapter, start_verse, coalesce(end_verse, start_verse))
  where deleted_at is null;

create trigger trg_bible_passage_references_set_updated_at
  before update on public.bible_passage_references
  for each row
  execute function public.set_updated_at();

alter table public.bible_passage_references enable row level security;

create policy bible_passage_references_select_public
  on public.bible_passage_references
  for select
  to anon, authenticated
  using (deleted_at is null);

create policy bible_passage_references_select_admin
  on public.bible_passage_references
  for select
  to authenticated
  using (public.is_admin() and app_security.session_is_valid());

create policy bible_passage_references_insert_admin
  on public.bible_passage_references
  for insert
  to authenticated
  with check (public.is_admin() and app_security.session_is_valid());

create policy bible_passage_references_update_admin
  on public.bible_passage_references
  for update
  to authenticated
  using (public.is_admin() and app_security.session_is_valid())
  with check (public.is_admin() and app_security.session_is_valid());

create policy bible_passage_references_delete_admin
  on public.bible_passage_references
  for delete
  to authenticated
  using (public.is_admin() and app_security.session_is_valid());

grant select on table public.bible_passage_references to anon, authenticated;
grant all on table public.bible_passage_references to service_role;

grant usage, select on sequence public.bible_passage_references_id_seq to service_role;
