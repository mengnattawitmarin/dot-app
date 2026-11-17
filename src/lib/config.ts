/**
 * Build-time configuration (Vite env). Set in GitHub → Settings → Secrets and variables → Actions:
 *   Variables: SUPABASE_URL, SUPABASE_ANON_KEY   (public by design — protected by row-level security)
 *   Secret:    GOOGLE_SERVICES_JSON              (turns on Firebase push for Android)
 * Locally: copy .env.example to .env.
 * When unset the app runs fully offline/local, exactly like before.
 */
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || "";
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || "";
export const PUSH_ENABLED = import.meta.env.VITE_PUSH_ENABLED === "1";

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Supabase free tier caps a single upload at 50 MB. */
export const MAX_CLOUD_UPLOAD = 50 * 1024 * 1024;
