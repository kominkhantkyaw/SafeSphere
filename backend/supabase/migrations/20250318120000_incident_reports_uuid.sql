-- =============================================================================
-- SafeSphere: incident_reports UUID primary key + UUID reporterId
-- =============================================================================
-- The web app (src/services/api.ts) now:
--   • Generates a client UUID for each new report (offline-safe).
--   • Upserts rows with onConflict: 'id' (same id locally and in Postgres).
--   • Sets reporterId to the Supabase Auth user id (auth.users.id / auth.uid()).
--
-- Run this ONLY after backing up your project. Adjust names to match your
-- actual safesphere_postgres.sql (FKs, indexes, RLS policies).
--
-- If your table still uses SERIAL/BIGINT id or INTEGER reporterId, you must
-- migrate data explicitly — see SCHEMA_MIGRATION_SQL.md and comments below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Greenfield / reference DDL (merge into your main schema file; do not run
--    blindly if incident_reports already exists with a different shape)
-- -----------------------------------------------------------------------------
/*
CREATE TABLE IF NOT EXISTS public.incident_reports (
  id uuid PRIMARY KEY,
  type text NOT NULL DEFAULT 'General',
  description text NOT NULL DEFAULT '',
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  timestamp timestamptz NOT NULL DEFAULT now(),
  urgency text,
  department text,
  "structuralDamage" text,
  "estRepairDays" integer,
  "estCost" numeric,
  repeatable boolean,
  "situationDiscussed" boolean,
  "mitigationPlan" text,
  "contactPerson" text,
  "contactPhone" text,
  "contactEmail" text,
  image text,
  video text,
  audio text,
  "adminNotes" text,
  comments jsonb,
  "reporterId" uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_timestamp ON public.incident_reports (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_incident_reports_reporter ON public.incident_reports ("reporterId");

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
-- Add / update SELECT, INSERT, UPDATE policies so reporters can read their rows
-- and staff can triage (see your existing RLS section).
*/

-- -----------------------------------------------------------------------------
-- B) Example migration from INTEGER id → UUID (destructive to old numeric ids)
--    Uncomment and customise FK drops on dependent tables first.
-- -----------------------------------------------------------------------------
/*
ALTER TABLE public.incident_reports ADD COLUMN IF NOT EXISTS id_uuid uuid;

UPDATE public.incident_reports SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;

-- Drop dependent FKs, e.g.:
-- ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_report_id_fkey;

ALTER TABLE public.incident_reports DROP CONSTRAINT IF EXISTS incident_reports_pkey;
ALTER TABLE public.incident_reports DROP COLUMN IF EXISTS id;
ALTER TABLE public.incident_reports RENAME COLUMN id_uuid TO id;
ALTER TABLE public.incident_reports ADD PRIMARY KEY (id);

-- reporterId: if it stored numeric mock ids, map via a temp users table or set NULL
-- then backfill from auth.users after users are provisioned:
ALTER TABLE public.incident_reports
  ALTER COLUMN "reporterId" TYPE uuid USING (NULL);
*/

-- -----------------------------------------------------------------------------
-- C) Lightweight check after you apply your migration
-- -----------------------------------------------------------------------------
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'incident_reports'
--   AND column_name IN ('id', 'reporterId');
