create or replace function public.enforce_comment_blip_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare
  v_parent public.blips%rowtype;
  v_visitor public.visitors%rowtype;
  v_role public.app_role;
  v_is_trusted boolean := false;
  v_visitor_id uuid;
  v_visitor_user_id uuid;
  v_visitor_display_name text;
  v_visitor_status public.visitor_status;
  v_visitor_failed_login_attempts integer;
  v_visitor_notes text;
  v_visitor_trusted boolean;
  v_visitor_avatar_seed text;
  v_visitor_avatar_version integer;
  v_visitor_created_at timestamptz;
begin
  if new.allow_comments is null then
    new.allow_comments := true;
  end if;

  if new.blip_type <> 'comment' then
    return new;
  end if;

  if new.parent_id is null then
    raise exception 'Comments require a parent blip';
  end if;

  select *
  into v_parent
  from public.blips
  where id = new.parent_id;

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
    v.id,
    v.user_id,
    v.display_name,
    v.status,
    v.failed_login_attempts,
    v.notes,
    v.trusted,
    v.avatar_seed,
    v.avatar_version,
    v.created_at,
    ur.role
  into
    v_visitor_id,
    v_visitor_user_id,
    v_visitor_display_name,
    v_visitor_status,
    v_visitor_failed_login_attempts,
    v_visitor_notes,
    v_visitor_trusted,
    v_visitor_avatar_seed,
    v_visitor_avatar_version,
    v_visitor_created_at,
    v_role
  from public.visitors v
  left join public.user_roles ur
    on ur.user_id = v.user_id
  where v.user_id = new.user_id
  limit 1;

  if not found then
    raise exception 'Visitor profile not found';
  end if;

  v_visitor.id := v_visitor_id;
  v_visitor.user_id := v_visitor_user_id;
  v_visitor.display_name := v_visitor_display_name;
  v_visitor.status := v_visitor_status;
  v_visitor.failed_login_attempts := v_visitor_failed_login_attempts;
  v_visitor.notes := v_visitor_notes;
  v_visitor.trusted := v_visitor_trusted;
  v_visitor.avatar_seed := v_visitor_avatar_seed;
  v_visitor.avatar_version := v_visitor_avatar_version;
  v_visitor.created_at := v_visitor_created_at;

  if v_visitor.status = 'locked' then
    raise exception 'Locked visitors cannot comment';
  end if;

  if tg_op = 'INSERT' then
    v_is_trusted := coalesce(v_visitor.trusted, false) or coalesce(v_role in ('admin', 'superuser'), false);
    if v_visitor.status = 'active' and v_is_trusted then
      new.published := true;
      new.moderation_status := 'approved';
    else
      new.published := false;
      new.moderation_status := 'pending';
    end if;
  end if;

  return new;
end;
$$;
