


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "app_security";


ALTER SCHEMA "app_security" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'superuser',
    'admin',
    'visitor'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."visitor_status" AS ENUM (
    'pending',
    'active',
    'locked'
);


ALTER TYPE "public"."visitor_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app_security"."cleanup_old_sessions"("retention" interval DEFAULT '30 days'::interval) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_security', 'public', 'auth'
    AS $$
declare
  deleted_count integer := 0;
begin
  delete from app_security.user_sessions
  where
    (revoked_at is not null and revoked_at < now() - retention)
    or
    (expires_at < now() and expires_at < now() - retention);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


ALTER FUNCTION "app_security"."cleanup_old_sessions"("retention" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app_security"."current_session_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $_$
  with jwt as (
    select
      auth.jwt() ->> 'session_id' as sid,
      auth.uid()::text || ':' || coalesce(auth.jwt() ->> 'iat', '0') as seed
  ),
  hashed as (
    select sid, md5(seed) as h
    from jwt
  )
  select case
    when sid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then sid::uuid
    else (
      substr(h, 1, 8) || '-' ||
      substr(h, 9, 4) || '-' ||
      substr(h, 13, 4) || '-' ||
      substr(h, 17, 4) || '-' ||
      substr(h, 21, 12)
    )::uuid
  end
  from hashed
$_$;


ALTER FUNCTION "app_security"."current_session_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app_security"."revoke_all_user_sessions"("target_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_security', 'public', 'auth'
    AS $$
declare
  affected_count integer := 0;
begin
  if target_user_id is null then
    return 0;
  end if;

  update app_security.user_sessions
  set revoked_at = now()
  where user_id = target_user_id
    and revoked_at is null;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;


ALTER FUNCTION "app_security"."revoke_all_user_sessions"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app_security"."revoke_current_session"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_security', 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := app_security.current_session_id();
begin
  if v_user_id is null or v_session_id is null then
    return;
  end if;

  update app_security.user_sessions
  set revoked_at = now()
  where session_id = v_session_id
    and user_id = v_user_id
    and revoked_at is null;
end;
$$;


ALTER FUNCTION "app_security"."revoke_current_session"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app_security"."session_is_valid"("max_age" interval DEFAULT '7 days'::interval) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_security', 'public', 'auth'
    AS $$
  select exists (
    select 1
    from app_security.user_sessions s
    where s.session_id = app_security.current_session_id()
      and s.user_id = auth.uid()
      and s.revoked_at is null
      and s.expires_at > now()
      and s.started_at >= now() - max_age
  )
$$;


ALTER FUNCTION "app_security"."session_is_valid"("max_age" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app_security"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "app_security"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "app_security"."start_session"("ttl" interval DEFAULT '7 days'::interval) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'app_security', 'public', 'auth'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := app_security.current_session_id();
begin
  if v_user_id is null or v_session_id is null then
    raise exception 'Missing auth context (user/session)';
  end if;

  insert into app_security.user_sessions(
    session_id,
    user_id,
    started_at,
    expires_at,
    revoked_at
  )
  values (
    v_session_id,
    v_user_id,
    now(),
    now() + ttl,
    null
  )
  on conflict (session_id) do nothing;
end;
$$;


ALTER FUNCTION "app_security"."start_session"("ttl" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_sessions"("retention" interval DEFAULT '30 days'::interval) RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_security', 'public', 'auth'
    AS $$
  select app_security.cleanup_old_sessions(retention)
$$;


ALTER FUNCTION "public"."cleanup_old_sessions"("retention" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select ur.role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  limit 1
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'visitor')
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_visitor_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_display_name text;
begin
  v_display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if v_display_name is null then
    v_display_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  if v_display_name is null then
    v_display_name := 'visitor';
  end if;

  insert into public.visitors (
    user_id,
    display_name,
    status,
    failed_login_attempts
  )
  values (
    new.id,
    v_display_name,
    'pending'::public.visitor_status,
    0
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_visitor_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(public.current_user_role() in ('superuser', 'admin'), false)
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_superuser"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(public.current_user_role() = 'superuser', false)
$$;


ALTER FUNCTION "public"."is_superuser"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_failed_visitor_login_attempt"("target_email" "text", "max_attempts" integer DEFAULT 5) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  normalized_email text := lower(trim(coalesce(target_email, '')));
  v_user_id uuid;
  v_failed_attempts integer := 0;
  v_locked boolean := false;
begin
  if normalized_email = '' then
    return jsonb_build_object('found', false, 'locked', false, 'failed_attempts', 0);
  end if;

  select u.id
  into v_user_id
  from auth.users u
  where lower(u.email) = normalized_email
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('found', false, 'locked', false, 'failed_attempts', 0);
  end if;

  update public.visitors v
  set
    failed_login_attempts = v.failed_login_attempts + 1,
    status = case
      when v.failed_login_attempts + 1 >= greatest(max_attempts, 1)
        then 'locked'::public.visitor_status
      else v.status
    end
  where v.user_id = v_user_id
  returning
    v.failed_login_attempts,
    (v.status = 'locked'::public.visitor_status)
  into
    v_failed_attempts,
    v_locked;

  if not found then
    insert into public.visitors (user_id, display_name, status, failed_login_attempts)
    values (
      v_user_id,
      coalesce(nullif(split_part(normalized_email, '@', 1), ''), 'visitor'),
      case
        when greatest(max_attempts, 1) <= 1 then 'locked'::public.visitor_status
        else 'pending'::public.visitor_status
      end,
      1
    )
    returning
      failed_login_attempts,
      (status = 'locked'::public.visitor_status)
    into
      v_failed_attempts,
      v_locked;
  end if;

  return jsonb_build_object(
    'found', true,
    'locked', v_locked,
    'failed_attempts', v_failed_attempts
  );
end;
$$;


ALTER FUNCTION "public"."record_failed_visitor_login_attempt"("target_email" "text", "max_attempts" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_current_session"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_security', 'public', 'auth'
    AS $$
  select app_security.revoke_current_session()
$$;


ALTER FUNCTION "public"."revoke_current_session"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."session_is_valid"("max_age" interval DEFAULT '7 days'::interval) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'app_security', 'public', 'auth'
    AS $$
  select app_security.session_is_valid(max_age)
$$;


ALTER FUNCTION "public"."session_is_valid"("max_age" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_session"("ttl" interval DEFAULT '7 days'::interval) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'app_security', 'public', 'auth'
    AS $$
  select app_security.start_session(ttl)
$$;


ALTER FUNCTION "public"."start_session"("ttl" interval) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_visitor_state"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.visitors
  set failed_login_attempts = 0
  where user_id = auth.uid()
    and failed_login_attempts <> 0;
end;
$$;


ALTER FUNCTION "public"."sync_visitor_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_blip_on_reaction_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."touch_blip_on_reaction_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_profile"("next_display_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  normalized_display_name text := nullif(trim(coalesce(next_display_name, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not app_security.session_is_valid() then
    raise exception 'Session is invalid';
  end if;

  if normalized_display_name is null then
    raise exception 'Display name is required';
  end if;

  update public.visitors
  set display_name = normalized_display_name
  where user_id = auth.uid();

  if not found then
    raise exception 'Visitor profile not found';
  end if;
end;
$$;


ALTER FUNCTION "public"."update_profile"("next_display_name" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "app_security"."user_sessions" (
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "app_security"."user_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blip_tags" (
    "blip_id" "text" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."blip_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blips" (
    "id" character varying(17) NOT NULL,
    "parent_id" character varying(17),
    "user_id" "uuid",
    "title" "text",
    "content" "text",
    "published" boolean DEFAULT false,
    "moderation_status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "blip_type" "text" DEFAULT 'root'::"text" NOT NULL,
    CONSTRAINT "blips_moderation_status_check" CHECK (("moderation_status" = ANY (ARRAY['auto-approved'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text", 'flagged'::"text"])))
);


ALTER TABLE "public"."blips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blip_id" "text" NOT NULL,
    "visitor_id" "uuid" NOT NULL,
    "emoji" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tags_name_canonical_chk" CHECK (("name" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'visitor'::"public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."victors-work" (
    "id" bigint NOT NULL,
    "passage" "text" NOT NULL,
    "chapter" character varying(50),
    "inserted_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."victors-work" OWNER TO "postgres";


ALTER TABLE "public"."victors-work" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."victors-work_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."visitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "status" "public"."visitor_status" DEFAULT 'pending'::"public"."visitor_status" NOT NULL,
    "failed_login_attempts" integer DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "visitors_failed_login_attempts_check" CHECK (("failed_login_attempts" >= 0))
);


ALTER TABLE "public"."visitors" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_blips" WITH ("security_invoker"='true') AS
 WITH "root_tags" AS (
         SELECT "bt"."blip_id",
            "jsonb_agg"("jsonb_build_object"('id', "t"."id", 'name', "t"."name", 'description', "t"."description") ORDER BY "t"."name") AS "tags"
           FROM ("public"."blip_tags" "bt"
             JOIN "public"."tags" "t" ON (("t"."id" = "bt"."tag_id")))
          GROUP BY "bt"."blip_id"
        ), "visible_reactions" AS (
         SELECT "rx"."blip_id",
            "rx"."emoji",
            "v"."user_id" AS "reactor_user_id",
            "v"."display_name"
           FROM ("public"."reactions" "rx"
             JOIN "public"."visitors" "v" ON (("v"."id" = "rx"."visitor_id")))
          WHERE (("v"."status" = 'active'::"public"."visitor_status") OR (("auth"."uid"() IS NOT NULL) AND ("v"."user_id" = "auth"."uid"())))
        ), "reaction_groups" AS (
         SELECT "vr"."blip_id",
            "vr"."emoji",
            ("count"(*))::integer AS "count",
            "bool_or"(("vr"."reactor_user_id" = "auth"."uid"())) AS "reacted_by_current_user",
                CASE
                    WHEN ("auth"."uid"() IS NULL) THEN '[]'::"jsonb"
                    ELSE "jsonb_agg"("vr"."display_name" ORDER BY "vr"."display_name")
                END AS "display_names"
           FROM "visible_reactions" "vr"
          GROUP BY "vr"."blip_id", "vr"."emoji"
        ), "reaction_totals" AS (
         SELECT "vr"."blip_id",
            ("count"(*))::integer AS "reactions_count",
            ("count"(*) FILTER (WHERE ("vr"."reactor_user_id" = "auth"."uid"())))::integer AS "my_reaction_count"
           FROM "visible_reactions" "vr"
          GROUP BY "vr"."blip_id"
        ), "reaction_data" AS (
         SELECT "rg"."blip_id",
            COALESCE("rt_1"."reactions_count", 0) AS "reactions_count",
            COALESCE("rt_1"."my_reaction_count", 0) AS "my_reaction_count",
            "jsonb_agg"("jsonb_build_object"('emoji', "rg"."emoji", 'count', "rg"."count", 'reacted_by_current_user', "rg"."reacted_by_current_user", 'display_names', COALESCE("rg"."display_names", '[]'::"jsonb")) ORDER BY "rg"."emoji") AS "reactions"
           FROM ("reaction_groups" "rg"
             JOIN "reaction_totals" "rt_1" ON (("rt_1"."blip_id" = "rg"."blip_id")))
          GROUP BY "rg"."blip_id", "rt_1"."reactions_count", "rt_1"."my_reaction_count"
        ), "updates_by_root" AS (
         SELECT ("u"."parent_id")::"text" AS "root_id",
            ("count"(*))::integer AS "updates_count",
            "jsonb_agg"("jsonb_build_object"('id', "u"."id", 'parent_id', "u"."parent_id", 'user_id', "u"."user_id", 'title', "u"."title", 'content', "u"."content", 'published', "u"."published", 'moderation_status', "u"."moderation_status", 'created_at', "u"."created_at", 'updated_at', "u"."updated_at", 'blip_type', "u"."blip_type", 'reactions_count', COALESCE("urd"."reactions_count", 0), 'my_reaction_count', COALESCE("urd"."my_reaction_count", 0), 'reactions', COALESCE("urd"."reactions", '[]'::"jsonb")) ORDER BY "u"."created_at" DESC) AS "updates"
           FROM ("public"."blips" "u"
             LEFT JOIN "reaction_data" "urd" ON (("urd"."blip_id" = ("u"."id")::"text")))
          WHERE ("u"."blip_type" = 'update'::"text")
          GROUP BY "u"."parent_id"
        )
 SELECT "r"."id",
    "r"."parent_id",
    "r"."user_id",
    "r"."title",
    "r"."content",
    "r"."published",
    "r"."moderation_status",
    "r"."created_at",
    "r"."updated_at",
    "r"."blip_type",
    COALESCE("rt"."tags", '[]'::"jsonb") AS "tags",
    COALESCE("ubr"."updates_count", 0) AS "updates_count",
    COALESCE("ubr"."updates", '[]'::"jsonb") AS "updates",
    COALESCE("rd"."reactions_count", 0) AS "reactions_count",
    COALESCE("rd"."my_reaction_count", 0) AS "my_reaction_count",
    COALESCE("rd"."reactions", '[]'::"jsonb") AS "reactions"
   FROM ((("public"."blips" "r"
     LEFT JOIN "root_tags" "rt" ON (("rt"."blip_id" = ("r"."id")::"text")))
     LEFT JOIN "updates_by_root" "ubr" ON (("ubr"."root_id" = ("r"."id")::"text")))
     LEFT JOIN "reaction_data" "rd" ON (("rd"."blip_id" = ("r"."id")::"text")))
  WHERE (("r"."parent_id" IS NULL) AND ("r"."blip_type" = 'root'::"text"));


ALTER VIEW "public"."view_blips" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."view_user" WITH ("security_invoker"='true') AS
 SELECT "ur"."user_id",
    "ur"."role",
    "ur"."created_at" AS "role_created_at",
    "ur"."updated_at" AS "role_updated_at",
    "v"."id" AS "visitor_id",
    "v"."display_name" AS "visitor_display_name",
    "v"."status" AS "visitor_status",
    "v"."failed_login_attempts" AS "visitor_failed_login_attempts",
    "v"."notes" AS "visitor_notes",
    "v"."created_at" AS "visitor_created_at"
   FROM ("public"."user_roles" "ur"
     LEFT JOIN "public"."visitors" "v" ON (("v"."user_id" = "ur"."user_id")))
  WHERE ("ur"."user_id" = "auth"."uid"());


ALTER VIEW "public"."view_user" OWNER TO "postgres";


ALTER TABLE ONLY "app_security"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("session_id");



ALTER TABLE ONLY "public"."blip_tags"
    ADD CONSTRAINT "blip_tags_pkey" PRIMARY KEY ("blip_id", "tag_id");



ALTER TABLE ONLY "public"."blips"
    ADD CONSTRAINT "blips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_blip_visitor_emoji_unique" UNIQUE ("blip_id", "visitor_id", "emoji");



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."victors-work"
    ADD CONSTRAINT "victors-work_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visitors"
    ADD CONSTRAINT "visitors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visitors"
    ADD CONSTRAINT "visitors_user_id_key" UNIQUE ("user_id");



CREATE INDEX "user_sessions_expires_at_idx" ON "app_security"."user_sessions" USING "btree" ("expires_at");



CREATE INDEX "user_sessions_user_id_idx" ON "app_security"."user_sessions" USING "btree" ("user_id");



CREATE INDEX "blip_tags_blip_id_idx" ON "public"."blip_tags" USING "btree" ("blip_id");



CREATE INDEX "blip_tags_tag_id_idx" ON "public"."blip_tags" USING "btree" ("tag_id");



CREATE INDEX "blips_root_feed_created_at_idx" ON "public"."blips" USING "btree" ("created_at" DESC) WHERE (("parent_id" IS NULL) AND ("blip_type" = 'root'::"text"));



CREATE INDEX "blips_updates_parent_created_at_idx" ON "public"."blips" USING "btree" ("parent_id", "created_at" DESC) WHERE ("blip_type" = 'update'::"text");



CREATE INDEX "reactions_blip_id_idx" ON "public"."reactions" USING "btree" ("blip_id");



CREATE INDEX "reactions_created_at_idx" ON "public"."reactions" USING "btree" ("created_at" DESC);



CREATE INDEX "reactions_visitor_id_idx" ON "public"."reactions" USING "btree" ("visitor_id");



CREATE INDEX "user_roles_created_at_idx" ON "public"."user_roles" USING "btree" ("created_at" DESC);



CREATE INDEX "user_roles_role_idx" ON "public"."user_roles" USING "btree" ("role");



CREATE INDEX "visitors_created_at_idx" ON "public"."visitors" USING "btree" ("created_at" DESC);



CREATE INDEX "visitors_status_idx" ON "public"."visitors" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "trg_user_sessions_updated_at" BEFORE UPDATE ON "app_security"."user_sessions" FOR EACH ROW EXECUTE FUNCTION "app_security"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_reactions_touch_blip" AFTER INSERT OR DELETE ON "public"."reactions" FOR EACH ROW EXECUTE FUNCTION "public"."touch_blip_on_reaction_change"();



CREATE OR REPLACE TRIGGER "trg_tags_set_updated_at" BEFORE UPDATE ON "public"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_roles_updated_at" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "app_security"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blip_tags"
    ADD CONSTRAINT "blip_tags_blip_id_fkey" FOREIGN KEY ("blip_id") REFERENCES "public"."blips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blip_tags"
    ADD CONSTRAINT "blip_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blips"
    ADD CONSTRAINT "blips_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."blips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_blip_id_fkey" FOREIGN KEY ("blip_id") REFERENCES "public"."blips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reactions"
    ADD CONSTRAINT "reactions_visitor_id_fkey" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visitors"
    ADD CONSTRAINT "visitors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow anon to delete victors-work" ON "public"."victors-work" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Allow anon to insert victors-work" ON "public"."victors-work" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow anon to select victors-work" ON "public"."victors-work" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Anonymous can create guest blips" ON "public"."blips" FOR INSERT WITH CHECK (("user_id" IS NULL));



CREATE POLICY "Authenticated users can create blips" ON "public"."blips" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own blips" ON "public"."blips" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own blips" ON "public"."blips" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."blip_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blip_tags_delete_owner_valid_session" ON "public"."blip_tags" FOR DELETE TO "authenticated" USING (("app_security"."session_is_valid"() AND (EXISTS ( SELECT 1
   FROM "public"."blips" "b"
  WHERE ((("b"."id")::"text" = "blip_tags"."blip_id") AND ("b"."user_id" = "auth"."uid"()))))));



CREATE POLICY "blip_tags_insert_owner_valid_session" ON "public"."blip_tags" FOR INSERT TO "authenticated" WITH CHECK (("app_security"."session_is_valid"() AND (EXISTS ( SELECT 1
   FROM "public"."blips" "b"
  WHERE ((("b"."id")::"text" = "blip_tags"."blip_id") AND ("b"."user_id" = "auth"."uid"()))))));



CREATE POLICY "blip_tags_select_if_blip_visible" ON "public"."blip_tags" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."blips" "b"
  WHERE ((("b"."id")::"text" = "blip_tags"."blip_id") AND (("b"."published" IS TRUE) OR (("auth"."role"() = 'authenticated'::"text") AND ("auth"."uid"() = "b"."user_id")))))));



CREATE POLICY "blip_tags_update_owner_valid_session" ON "public"."blip_tags" FOR UPDATE TO "authenticated" USING (("app_security"."session_is_valid"() AND (EXISTS ( SELECT 1
   FROM "public"."blips" "b"
  WHERE ((("b"."id")::"text" = "blip_tags"."blip_id") AND ("b"."user_id" = "auth"."uid"())))))) WITH CHECK (("app_security"."session_is_valid"() AND (EXISTS ( SELECT 1
   FROM "public"."blips" "b"
  WHERE ((("b"."id")::"text" = "blip_tags"."blip_id") AND ("b"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."blips" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blips_delete_owner_valid_session" ON "public"."blips" FOR DELETE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND "app_security"."session_is_valid"()));



CREATE POLICY "blips_insert_owner_valid_session" ON "public"."blips" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND "app_security"."session_is_valid"()));



CREATE POLICY "blips_select_published_or_owner" ON "public"."blips" FOR SELECT TO "authenticated", "anon" USING ((("published" IS TRUE) OR (("auth"."role"() = 'authenticated'::"text") AND ("auth"."uid"() = "user_id"))));



CREATE POLICY "blips_update_owner_valid_session" ON "public"."blips" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND "app_security"."session_is_valid"())) WITH CHECK ((("auth"."uid"() = "user_id") AND "app_security"."session_is_valid"()));



ALTER TABLE "public"."reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reactions_delete_admin_all" ON "public"."reactions" FOR DELETE TO "authenticated" USING (("public"."is_admin"() AND "app_security"."session_is_valid"()));



CREATE POLICY "reactions_delete_own_authenticated" ON "public"."reactions" FOR DELETE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."visitors" "v"
  WHERE (("v"."id" = "reactions"."visitor_id") AND ("v"."user_id" = "auth"."uid"())))) AND "app_security"."session_is_valid"()));



CREATE POLICY "reactions_insert_admin_all" ON "public"."reactions" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() AND "app_security"."session_is_valid"()));



CREATE POLICY "reactions_insert_own_authenticated" ON "public"."reactions" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."visitors" "v"
  WHERE (("v"."id" = "reactions"."visitor_id") AND ("v"."user_id" = "auth"."uid"()) AND ("v"."status" <> 'locked'::"public"."visitor_status")))) AND "app_security"."session_is_valid"()));



CREATE POLICY "reactions_select_active_public" ON "public"."reactions" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."visitors" "v"
  WHERE (("v"."id" = "reactions"."visitor_id") AND ("v"."status" = 'active'::"public"."visitor_status")))));



CREATE POLICY "reactions_select_admin_all" ON "public"."reactions" FOR SELECT TO "authenticated" USING (("public"."is_admin"() AND "app_security"."session_is_valid"()));



CREATE POLICY "reactions_select_own_authenticated" ON "public"."reactions" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."visitors" "v"
  WHERE (("v"."id" = "reactions"."visitor_id") AND ("v"."user_id" = "auth"."uid"())))) AND "app_security"."session_is_valid"()));



CREATE POLICY "reactions_update_admin_all" ON "public"."reactions" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() AND "app_security"."session_is_valid"())) WITH CHECK (("public"."is_admin"() AND "app_security"."session_is_valid"()));



ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tags_delete_valid_session" ON "public"."tags" FOR DELETE TO "authenticated" USING ("app_security"."session_is_valid"());



CREATE POLICY "tags_insert_valid_session" ON "public"."tags" FOR INSERT TO "authenticated" WITH CHECK ("app_security"."session_is_valid"());



CREATE POLICY "tags_select_if_linked_blip_visible" ON "public"."tags" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."blip_tags" "bt"
     JOIN "public"."blips" "b" ON ((("b"."id")::"text" = "bt"."blip_id")))
  WHERE (("bt"."tag_id" = "tags"."id") AND (("b"."published" IS TRUE) OR (("auth"."role"() = 'authenticated'::"text") AND ("auth"."uid"() = "b"."user_id")))))));



CREATE POLICY "tags_select_public" ON "public"."tags" FOR SELECT USING (true);



CREATE POLICY "tags_update_valid_session" ON "public"."tags" FOR UPDATE TO "authenticated" USING ("app_security"."session_is_valid"()) WITH CHECK ("app_security"."session_is_valid"());



ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_delete_superuser" ON "public"."user_roles" FOR DELETE TO "authenticated" USING (("public"."is_superuser"() AND "app_security"."session_is_valid"()));



CREATE POLICY "user_roles_insert_superuser" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_superuser"() AND "app_security"."session_is_valid"()));



CREATE POLICY "user_roles_select_own_authenticated" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "app_security"."session_is_valid"()));



CREATE POLICY "user_roles_select_superuser_all" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("public"."is_superuser"() AND "app_security"."session_is_valid"()));



CREATE POLICY "user_roles_update_superuser" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING (("public"."is_superuser"() AND "app_security"."session_is_valid"())) WITH CHECK (("public"."is_superuser"() AND "app_security"."session_is_valid"()));



ALTER TABLE "public"."victors-work" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visitors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visitors_delete_admin_all" ON "public"."visitors" FOR DELETE TO "authenticated" USING (("public"."is_admin"() AND "app_security"."session_is_valid"()));



CREATE POLICY "visitors_insert_admin_all" ON "public"."visitors" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin"() AND "app_security"."session_is_valid"()));



CREATE POLICY "visitors_select_active_public" ON "public"."visitors" FOR SELECT TO "authenticated", "anon" USING (("status" = 'active'::"public"."visitor_status"));



CREATE POLICY "visitors_select_admin_all" ON "public"."visitors" FOR SELECT TO "authenticated" USING (("public"."is_admin"() AND "app_security"."session_is_valid"()));



CREATE POLICY "visitors_select_own_authenticated" ON "public"."visitors" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND "app_security"."session_is_valid"()));



CREATE POLICY "visitors_update_admin_all" ON "public"."visitors" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() AND "app_security"."session_is_valid"())) WITH CHECK (("public"."is_admin"() AND "app_security"."session_is_valid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."blips";



GRANT USAGE ON SCHEMA "app_security" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "app_security"."cleanup_old_sessions"("retention" interval) TO "authenticated";



GRANT ALL ON FUNCTION "app_security"."revoke_all_user_sessions"("target_user_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "app_security"."revoke_current_session"() TO "authenticated";



GRANT ALL ON FUNCTION "app_security"."session_is_valid"("max_age" interval) TO "authenticated";



GRANT ALL ON FUNCTION "app_security"."start_session"("ttl" interval) TO "authenticated";

























































































































































GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"("retention" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"("retention" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_sessions"("retention" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_visitor_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_visitor_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_visitor_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_superuser"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_superuser"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_superuser"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_failed_visitor_login_attempt"("target_email" "text", "max_attempts" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_failed_visitor_login_attempt"("target_email" "text", "max_attempts" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."record_failed_visitor_login_attempt"("target_email" "text", "max_attempts" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_failed_visitor_login_attempt"("target_email" "text", "max_attempts" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_current_session"() TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_current_session"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_current_session"() TO "service_role";



GRANT ALL ON FUNCTION "public"."session_is_valid"("max_age" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."session_is_valid"("max_age" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."session_is_valid"("max_age" interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_session"("ttl" interval) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_session"("ttl" interval) TO "anon";
GRANT ALL ON FUNCTION "public"."start_session"("ttl" interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_session"("ttl" interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_visitor_state"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_visitor_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_visitor_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_visitor_state"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_blip_on_reaction_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_blip_on_reaction_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_blip_on_reaction_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_profile"("next_display_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_profile"("next_display_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_profile"("next_display_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_profile"("next_display_name" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."blip_tags" TO "anon";
GRANT ALL ON TABLE "public"."blip_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."blip_tags" TO "service_role";



GRANT ALL ON TABLE "public"."blips" TO "anon";
GRANT ALL ON TABLE "public"."blips" TO "authenticated";
GRANT ALL ON TABLE "public"."blips" TO "service_role";



GRANT ALL ON TABLE "public"."reactions" TO "anon";
GRANT ALL ON TABLE "public"."reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."reactions" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."victors-work" TO "anon";
GRANT ALL ON TABLE "public"."victors-work" TO "authenticated";
GRANT ALL ON TABLE "public"."victors-work" TO "service_role";



GRANT ALL ON SEQUENCE "public"."victors-work_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."victors-work_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."victors-work_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."visitors" TO "anon";
GRANT ALL ON TABLE "public"."visitors" TO "authenticated";
GRANT ALL ON TABLE "public"."visitors" TO "service_role";



GRANT ALL ON TABLE "public"."view_blips" TO "anon";
GRANT ALL ON TABLE "public"."view_blips" TO "authenticated";
GRANT ALL ON TABLE "public"."view_blips" TO "service_role";



GRANT ALL ON TABLE "public"."view_user" TO "anon";
GRANT ALL ON TABLE "public"."view_user" TO "authenticated";
GRANT ALL ON TABLE "public"."view_user" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

drop policy "blip_tags_select_if_blip_visible" on "public"."blip_tags";

drop policy "blips_select_published_or_owner" on "public"."blips";

drop policy "reactions_select_active_public" on "public"."reactions";

drop policy "tags_select_if_linked_blip_visible" on "public"."tags";

drop policy "visitors_select_active_public" on "public"."visitors";


  create policy "blip_tags_select_if_blip_visible"
  on "public"."blip_tags"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.blips b
  WHERE (((b.id)::text = blip_tags.blip_id) AND ((b.published IS TRUE) OR ((auth.role() = 'authenticated'::text) AND (auth.uid() = b.user_id)))))));



  create policy "blips_select_published_or_owner"
  on "public"."blips"
  as permissive
  for select
  to anon, authenticated
using (((published IS TRUE) OR ((auth.role() = 'authenticated'::text) AND (auth.uid() = user_id))));



  create policy "reactions_select_active_public"
  on "public"."reactions"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.visitors v
  WHERE ((v.id = reactions.visitor_id) AND (v.status = 'active'::public.visitor_status)))));



  create policy "tags_select_if_linked_blip_visible"
  on "public"."tags"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM (public.blip_tags bt
     JOIN public.blips b ON (((b.id)::text = bt.blip_id)))
  WHERE ((bt.tag_id = tags.id) AND ((b.published IS TRUE) OR ((auth.role() = 'authenticated'::text) AND (auth.uid() = b.user_id)))))));



  create policy "visitors_select_active_public"
  on "public"."visitors"
  as permissive
  for select
  to anon, authenticated
using ((status = 'active'::public.visitor_status));


CREATE TRIGGER trg_auth_users_create_visitor_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_visitor_profile();

CREATE TRIGGER trg_auth_users_default_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user_role();


