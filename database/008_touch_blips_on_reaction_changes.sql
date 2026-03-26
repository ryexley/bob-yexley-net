-- ============================================================================
-- FILE: 008_touch_blips_on_reaction_changes.sql
-- PURPOSE:
--   Nudge the owning blip row whenever a reaction is inserted or deleted so the
--   existing blip realtime subscriptions can observe a change and refresh the
--   aggregated reaction state from `view_blips`.
-- ============================================================================

create or replace function public.touch_blip_on_reaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_blip_id text;
begin
  target_blip_id := coalesce(new.blip_id, old.blip_id);

  if target_blip_id is null then
    return coalesce(new, old);
  end if;

  update public.blips
  set updated_at = now()
  where id::text = target_blip_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_reactions_touch_blip on public.reactions;
create trigger trg_reactions_touch_blip
after insert or delete on public.reactions
for each row execute function public.touch_blip_on_reaction_change();
