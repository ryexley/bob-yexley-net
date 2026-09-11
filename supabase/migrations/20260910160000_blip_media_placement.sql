-- Inline vs gallery placement for blip media. Existing rows stay gallery.
alter table public.blip_media
  add column placement text not null default 'gallery';

alter table public.blip_media
  add constraint blip_media_placement_check
  check (placement = any (array['gallery'::text, 'inline'::text]));
