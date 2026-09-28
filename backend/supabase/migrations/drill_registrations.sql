-- =============================================================================
-- SafeSphere: drill_registrations (Prepare → Drills booking sync)
-- =============================================================================
-- Matches src/services/api.ts: getUserDrillRegistrationsWithSlots,
-- registerForDrill, unregisterFromDrill (columns: user_id, drill_id,
-- slot_date, slot_time).
--
-- Apply: Supabase Dashboard → SQL Editor, or `supabase db push` / migration run.
-- Ensure logged-in users have profiles.id (or auth.users.id) equal to the UUID
-- stored in the app as user.id so RLS policies allow reads/writes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.drill_registrations (
    user_id uuid NOT NULL,
    drill_id bigint NOT NULL,
    slot_date text,
    slot_time text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT drill_registrations_pkey PRIMARY KEY (user_id, drill_id)
);

CREATE INDEX IF NOT EXISTS idx_drill_registrations_drill_id ON public.drill_registrations (drill_id);

COMMENT ON TABLE public.drill_registrations IS 'User sign-ups for drill sessions (slot optional).';

ALTER TABLE public.drill_registrations ENABLE ROW LEVEL SECURITY;

-- Authenticated users: only their own rows (JWT sub must match user_id).
CREATE POLICY "drill_registrations_select_own"
    ON public.drill_registrations
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "drill_registrations_insert_own"
    ON public.drill_registrations
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "drill_registrations_update_own"
    ON public.drill_registrations
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "drill_registrations_delete_own"
    ON public.drill_registrations
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drill_registrations TO authenticated;
GRANT ALL ON public.drill_registrations TO service_role;

-- Optional (run manually if your public.drills.id type matches bigint):
-- ALTER TABLE public.drill_registrations
--   ADD CONSTRAINT drill_registrations_drill_id_fkey
--   FOREIGN KEY (drill_id) REFERENCES public.drills (id) ON DELETE CASCADE;
