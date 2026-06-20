create table public.analytics_events (
  id bigserial primary key,
  site_id text not null,
  event_type text not null default 'pageview',
  path text not null,
  referrer text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  visitor_hash text not null,
  browser text,
  browser_version text,
  os text,
  os_version text,
  device_type text,
  screen_width integer,
  screen_height integer,
  viewport_width integer,
  viewport_height integer,
  language text,
  is_bot boolean not null default false,
  bot_name text,
  properties jsonb,
  created_at timestamptz not null default now()
);

create index idx_ae_site_id on public.analytics_events (site_id);
create index idx_ae_created_at on public.analytics_events (created_at);
create index idx_ae_site_created on public.analytics_events (site_id, created_at);
create index idx_ae_event_type on public.analytics_events (site_id, event_type);
create index idx_ae_visitor_hash on public.analytics_events (visitor_hash);
create index idx_ae_path on public.analytics_events (site_id, path);
create index idx_ae_referrer_host on public.analytics_events (site_id, referrer_host);
create index idx_ae_device_type on public.analytics_events (site_id, device_type);
create index idx_ae_browser on public.analytics_events (site_id, browser);
create index idx_ae_os on public.analytics_events (site_id, os);

alter table public.analytics_events enable row level security;

create policy "No public access"
  on public.analytics_events
  for all
  using (false);

grant all on table public.analytics_events to service_role;
grant usage, select on sequence public.analytics_events_id_seq to service_role;

create or replace function public.analytics_stat_cards(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  unique_visitors bigint,
  total_pageviews bigint,
  views_per_visit numeric
)
language sql
stable
as $$
  select
    count(distinct visitor_hash) as unique_visitors,
    count(*) as total_pageviews,
    round(count(*)::numeric / nullif(count(distinct visitor_hash), 0), 2) as views_per_visit
  from public.analytics_events
  where site_id = p_site_id
    and event_type = 'pageview'
    and created_at >= p_from
    and created_at < p_to
    and is_bot = false;
$$;

create or replace function public.analytics_pageviews_over_time(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket interval default interval '1 day'
)
returns table (
  bucket timestamptz,
  pageviews bigint,
  unique_visitors bigint
)
language sql
stable
as $$
  select
    date_trunc(
      case
        when p_bucket <= interval '1 hour' then 'hour'
        else 'day'
      end,
      created_at
    ) as bucket,
    count(*) as pageviews,
    count(distinct visitor_hash) as unique_visitors
  from public.analytics_events
  where site_id = p_site_id
    and event_type = 'pageview'
    and created_at >= p_from
    and created_at < p_to
    and is_bot = false
  group by 1
  order by 1;
$$;

create or replace function public.analytics_top_pages(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 20
)
returns table (
  path text,
  pageviews bigint,
  visitors bigint
)
language sql
stable
as $$
  select
    path,
    count(*) as pageviews,
    count(distinct visitor_hash) as visitors
  from public.analytics_events
  where site_id = p_site_id
    and event_type = 'pageview'
    and created_at >= p_from
    and created_at < p_to
    and is_bot = false
  group by path
  order by visitors desc, pageviews desc
  limit p_limit;
$$;

create or replace function public.analytics_top_sources(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 20
)
returns table (
  source text,
  visitors bigint
)
language sql
stable
as $$
  select
    coalesce(referrer_host, 'Direct / None') as source,
    count(distinct visitor_hash) as visitors
  from public.analytics_events
  where site_id = p_site_id
    and event_type = 'pageview'
    and created_at >= p_from
    and created_at < p_to
    and is_bot = false
  group by source
  order by visitors desc
  limit p_limit;
$$;

create or replace function public.analytics_device_breakdown(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  device_type text,
  visitors bigint
)
language sql
stable
as $$
  select
    coalesce(device_type, 'desktop') as device_type,
    count(distinct visitor_hash) as visitors
  from public.analytics_events
  where site_id = p_site_id
    and event_type = 'pageview'
    and created_at >= p_from
    and created_at < p_to
    and is_bot = false
  group by device_type
  order by visitors desc;
$$;

create or replace function public.analytics_browser_breakdown(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 10
)
returns table (
  browser text,
  visitors bigint
)
language sql
stable
as $$
  select
    coalesce(browser, 'Unknown') as browser,
    count(distinct visitor_hash) as visitors
  from public.analytics_events
  where site_id = p_site_id
    and event_type = 'pageview'
    and created_at >= p_from
    and created_at < p_to
    and is_bot = false
  group by browser
  order by visitors desc
  limit p_limit;
$$;

create or replace function public.analytics_os_breakdown(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 10
)
returns table (
  os text,
  visitors bigint
)
language sql
stable
as $$
  select
    coalesce(os, 'Unknown') as os,
    count(distinct visitor_hash) as visitors
  from public.analytics_events
  where site_id = p_site_id
    and event_type = 'pageview'
    and created_at >= p_from
    and created_at < p_to
    and is_bot = false
  group by os
  order by visitors desc
  limit p_limit;
$$;

create or replace function public.analytics_ai_bot_traffic(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  bot_name text,
  hits bigint,
  distinct_pages_hit bigint
)
language sql
stable
as $$
  select
    bot_name,
    count(*) as hits,
    count(distinct path) as distinct_pages_hit
  from public.analytics_events
  where site_id = p_site_id
    and created_at >= p_from
    and created_at < p_to
    and is_bot = true
    and bot_name is not null
  group by bot_name
  order by hits desc;
$$;

create or replace function public.analytics_admin_hub_stats(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  total_pageviews bigint,
  site_count bigint
)
language sql
stable
as $$
  select
    (
      select count(*)
      from public.analytics_events
      where site_id = p_site_id
        and event_type = 'pageview'
        and created_at >= p_from
        and created_at < p_to
        and is_bot = false
    ) as total_pageviews,
    (
      select count(distinct site_id)
      from public.analytics_events
    ) as site_count;
$$;

create or replace function public.analytics_site_ids()
returns table (site_id text)
language sql
stable
as $$
  select distinct analytics_events.site_id
  from public.analytics_events
  order by 1;
$$;

grant execute on function public.analytics_stat_cards(text, timestamptz, timestamptz) to service_role;
grant execute on function public.analytics_pageviews_over_time(text, timestamptz, timestamptz, interval) to service_role;
grant execute on function public.analytics_top_pages(text, timestamptz, timestamptz, integer) to service_role;
grant execute on function public.analytics_top_sources(text, timestamptz, timestamptz, integer) to service_role;
grant execute on function public.analytics_device_breakdown(text, timestamptz, timestamptz) to service_role;
grant execute on function public.analytics_browser_breakdown(text, timestamptz, timestamptz, integer) to service_role;
grant execute on function public.analytics_os_breakdown(text, timestamptz, timestamptz, integer) to service_role;
grant execute on function public.analytics_ai_bot_traffic(text, timestamptz, timestamptz) to service_role;
grant execute on function public.analytics_admin_hub_stats(text, timestamptz, timestamptz) to service_role;
grant execute on function public.analytics_site_ids() to service_role;
