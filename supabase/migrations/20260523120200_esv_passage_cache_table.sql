create table public.esv_passage_cache (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  passage_text text not null,
  cached_at timestamptz not null default now()
);

create index esv_passage_cache_reference_idx
  on public.esv_passage_cache (reference);

grant all on table public.esv_passage_cache to service_role;
