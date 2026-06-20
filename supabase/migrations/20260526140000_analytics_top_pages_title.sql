drop function if exists public.analytics_top_pages(text, timestamptz, timestamptz, integer);

create or replace function public.analytics_top_pages(
  p_site_id text,
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 20
)
returns table (
  path text,
  page_title text,
  pageviews bigint,
  visitors bigint
)
language sql
stable
as $$
  select
    path,
    (
      array_agg(
        nullif(trim(properties->>'title'), '')
        order by created_at desc
      ) filter (where nullif(trim(properties->>'title'), '') is not null)
    )[1] as page_title,
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
