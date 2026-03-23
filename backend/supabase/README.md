# SafeSphere Supabase Setup (Online Mode)

SafeSphere uses a **dual-mode** storage system:
- **Online**: Data is stored in Supabase (PostgreSQL) when internet is available
- **Offline**: Data falls back to localStorage when offline or Supabase is not configured

## Compatible with safesphere_postgres.sql

The API is adapted to work with your existing **safesphere_postgres.sql** schema:
- Uses tables: `checklist`, `drills`, `alerts`, `resources`, `incident_reports`
- Uses camelCase columns: `structuralDamage`, `operatingHours`, `contactPerson`, etc.

## Setup Steps

### 1. Create a Supabase project (if not done)

1. Go to [supabase.com](https://supabase.com) and create a project
2. In **Project Settings → API**, copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key

### 2. Configure environment variables

Create or edit `.env.local` in the SafeSphere root:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Important**: Use your **project URL**, not `https://www.supabase.co`.

### 3. Run the schema

1. In Supabase Dashboard, open **SQL Editor**
2. Run **safesphere_postgres.sql** (includes base schema + migrations: tutorials, learn_items, RLS policies)

### 3b. UUID incident reports (offline–online sync)

The app **upserts** `incident_reports` with a **client-generated UUID** `id` and a **`reporterId` UUID** equal to the signed-in user’s Supabase Auth id (`auth.uid()`). If your database still uses `SERIAL` / integer `id` or non-UUID `reporterId`, online sync will fail until you migrate.

- Read **`backend/supabase/migrations/20250318120000_incident_reports_uuid.sql`** (reference DDL + commented migration steps).
- For a full narrative, see **`SCHEMA_MIGRATION_SQL.md`** at the repo root.

After migrating, ensure RLS policies allow reporters to **read** their own rows (by `"reporterId" = auth.uid()` or equivalent) so **Emergency → History** works.

### 4. Seed initial data (optional)

Your schema already has sample data for alerts, checklist, incident_reports, resources. The app will use it when online.

## Behaviour

- When **online** and Supabase is configured: fetches from and saves to Supabase; also caches in localStorage for offline use
- When **offline**: uses localStorage only
- When Supabase fails (e.g. network error): falls back to localStorage
