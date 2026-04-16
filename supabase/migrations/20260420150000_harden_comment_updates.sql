create or replace function public.enforce_comment_blip_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent public.blips;
  v_status public.visitor_status;
  v_trusted boolean := false;
  v_author_role public.app_role;
  v_actor_is_admin boolean := false;
begin
  if new.allow_comments is null then
    new.allow_comments := true;
  end if;

  if new.blip_type <> 'comment' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.blip_type is distinct from new.blip_type then
      raise exception 'Comment type cannot be changed';
    end if;

    if old.user_id is distinct from new.user_id then
      raise exception 'Comment author cannot be changed';
    end if;

    if old.parent_id is distinct from new.parent_id then
      raise exception 'Comment parent cannot be changed';
    end if;

    if old.allow_comments is distinct from new.allow_comments then
      raise exception 'Comment settings cannot be changed';
    end if;
  end if;

  select *
  into v_parent
  from public.blips
  where id = new.parent_id
  limit 1;

  if not found then
    raise exception 'Comment parent not found';
  end if;

  if v_parent.blip_type not in ('root', 'update') then
    raise exception 'Comments may only attach to root or update blips';
  end if;

  if tg_op = 'INSERT' and coalesce(v_parent.allow_comments, true) is not true then
    raise exception 'Comments are disabled for this blip';
  end if;

  if new.user_id is null then
    raise exception 'Comments require an authenticated author';
  end if;

  select
    us.status,
    us.trusted,
    ur.role
  into
    v_status,
    v_trusted,
    v_author_role
  from public.user_profile up
  join public.user_system us
    on us.user_profile_id = up.id
  left join public.user_roles ur
    on ur.user_id = up.user_id
  where up.user_id = new.user_id
  limit 1;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_status = 'locked' then
    raise exception 'Locked users cannot comment';
  end if;

  v_actor_is_admin := coalesce(public.is_admin(), false) and app_security.session_is_valid();

  if tg_op = 'INSERT' then
    if v_status = 'active' and (coalesce(v_trusted, false) or coalesce(v_author_role in ('admin', 'superuser'), false)) then
      new.published := true;
      new.moderation_status := 'approved';
    else
      new.published := false;
      new.moderation_status := 'pending';
    end if;
  elsif not v_actor_is_admin then
    if old.published is distinct from new.published then
      raise exception 'Only admins may change comment publication';
    end if;

    if old.moderation_status is distinct from new.moderation_status then
      raise exception 'Only admins may change comment moderation';
    end if;
  end if;

  return new;
end;
$$;
