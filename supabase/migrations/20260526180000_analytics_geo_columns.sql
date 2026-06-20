alter table public.analytics_events
  add column country_code text,
  add column city_name text,
  add column region_code text;

create index idx_ae_country_code on public.analytics_events (site_id, country_code);
create index idx_ae_city_name on public.analytics_events (site_id, country_code, city_name);

create or replace function public.analytics_top_countries(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_min_visitors integer default 5,
  p_limit integer default 20
)
returns table (
  country_code text,
  visitors bigint,
  pageviews bigint
)
language sql
stable
as $$
  select
    country_code,
    count(distinct visitor_hash) as visitors,
    count(*) as pageviews
  from public.analytics_events
  where site_id = p_site_id
    and event_type = 'pageview'
    and created_at >= p_from
    and created_at < p_to
    and is_bot = false
    and country_code is not null
  group by country_code
  having count(distinct visitor_hash) >= p_min_visitors
  order by visitors desc, pageviews desc
  limit p_limit;
$$;

create or replace function public.analytics_top_cities(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_min_visitors integer default 5,
  p_limit integer default 20
)
returns table (
  country_code text,
  city_name text,
  visitors bigint,
  pageviews bigint
)
language sql
stable
as $$
  select
    country_code,
    city_name,
    count(distinct visitor_hash) as visitors,
    count(*) as pageviews
  from public.analytics_events
  where site_id = p_site_id
    and event_type = 'pageview'
    and created_at >= p_from
    and created_at < p_to
    and is_bot = false
    and country_code is not null
    and city_name is not null
  group by country_code, city_name
  having count(distinct visitor_hash) >= p_min_visitors
  order by visitors desc, pageviews desc
  limit p_limit;
$$;

grant execute on function public.analytics_top_countries(text, timestamptz, timestamptz, integer, integer) to service_role;
grant execute on function public.analytics_top_cities(text, timestamptz, timestamptz, integer, integer) to service_role;
