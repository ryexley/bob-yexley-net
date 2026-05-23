create table public.bible_passage_reference_collections (
  reference_id integer not null references public.bible_passage_references (id) on delete cascade,
  collection_id integer not null references public.bible_passage_collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reference_id, collection_id)
);

create index bible_passage_reference_collections_collection_idx
  on public.bible_passage_reference_collections (collection_id);

insert into public.bible_passage_reference_collections (reference_id, collection_id)
select id, collection_id
from public.bible_passage_references
where collection_id is not null
  and deleted_at is null;

alter table public.bible_passage_references
  drop constraint if exists bible_passage_references_collection_id_fkey;

drop index if exists public.bible_passage_references_collection_idx;

alter table public.bible_passage_references
  drop column if exists collection_id;

alter table public.bible_passage_reference_collections enable row level security;

create policy bible_passage_reference_collections_select_public
  on public.bible_passage_reference_collections
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.bible_passage_references reference_row
      where reference_row.id = reference_id
        and reference_row.deleted_at is null
    )
    and exists (
      select 1
      from public.bible_passage_collections collection_row
      where collection_row.id = collection_id
        and collection_row.deleted_at is null
    )
  );

create policy bible_passage_reference_collections_select_admin
  on public.bible_passage_reference_collections
  for select
  to authenticated
  using (public.is_admin() and app_security.session_is_valid());

create policy bible_passage_reference_collections_insert_admin
  on public.bible_passage_reference_collections
  for insert
  to authenticated
  with check (public.is_admin() and app_security.session_is_valid());

create policy bible_passage_reference_collections_update_admin
  on public.bible_passage_reference_collections
  for update
  to authenticated
  using (public.is_admin() and app_security.session_is_valid())
  with check (public.is_admin() and app_security.session_is_valid());

create policy bible_passage_reference_collections_delete_admin
  on public.bible_passage_reference_collections
  for delete
  to authenticated
  using (public.is_admin() and app_security.session_is_valid());

grant select on table public.bible_passage_reference_collections to anon, authenticated;
grant all on table public.bible_passage_reference_collections to service_role;
