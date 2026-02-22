-- WebAuthn (Face ID / Touch ID) support
-- Run after safesphere_postgres.sql. Requires auth.users (Supabase Auth).

-- Credentials stored after WebAuthn registration
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text UNIQUE NOT NULL,
  public_key_cose text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Optional: challenges for auth (can use in-memory or this table with short TTL)
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge text NOT NULL,
  email text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON public.webauthn_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_credential_id ON public.webauthn_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_email ON public.webauthn_challenges(email);

-- RLS: only service role can read/write (Edge Function uses service role)
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Policy: no direct client access; Edge Function uses service_role
CREATE POLICY "Service role only" ON public.webauthn_credentials FOR ALL USING (false);
CREATE POLICY "Service role only" ON public.webauthn_challenges FOR ALL USING (false);
