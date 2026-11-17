/**
 * Build-time configuration (Vite env). Set in GitHub → Settings → Secrets and variables → Actions:
 *   Variables: SUPABASE_URL, SUPABASE_ANON_KEY   (public by design — protected by row-level security)
 *   Secret:    GOOGLE_SERVICES_JSON              (turns on Firebase push for Android)
 * Locally: copy .env.example to .env to point at another project.
 */
// Defaults point at the Do.T production project. The publishable key is meant to ship in
// client apps — access is enforced by row-level security (supabase/migrations).
const DEFAULT_URL = "https://hnlkxlvhsjsqjgoosrqp.supabase.co";
const DEFAULT_KEY = "sb_publishable_dZmT-f2apAGBVlaz8DcinA_aEr0gVAs";

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || DEFAULT_URL;
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || DEFAULT_KEY;
export const PUSH_ENABLED = import.meta.env.VITE_PUSH_ENABLED === "1";

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Supabase free tier caps a single upload at 50 MB. */
export const MAX_CLOUD_UPLOAD = 50 * 1024 * 1024;
