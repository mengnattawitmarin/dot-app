import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { create } from "zustand";
import { cloudEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { loadValue, removeValue, saveValue } from "@/lib/storage";

/** Null when the backend isn't configured — every caller must handle that. */
export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Capacitor Preferences on native (survives WebView storage eviction), localStorage on web.
        storage: { getItem: loadValue, setItem: saveValue, removeItem: removeValue },
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export type Profile = { id: string; handle: string; display_name: string | null };

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  pendingEmail: string | null;
};

export const useAuth = create<AuthState>(() => ({ ready: !cloudEnabled, session: null, profile: null, pendingEmail: null }));

async function loadProfile(userId: string) {
  if (!supabase) return;
  const { data } = await supabase.from("profiles").select("id, handle, display_name").eq("id", userId).maybeSingle();
  useAuth.setState({ profile: (data as Profile | null) ?? null });
}

export async function initAuth(onSignedIn: () => void) {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  useAuth.setState({ session: data.session, ready: true });
  if (data.session) {
    void loadProfile(data.session.user.id);
    onSignedIn();
  }
  supabase.auth.onAuthStateChange((event, session) => {
    useAuth.setState({ session });
    if (event === "SIGNED_IN" && session) {
      void loadProfile(session.user.id);
      onSignedIn();
    }
    if (event === "SIGNED_OUT") useAuth.setState({ profile: null });
  });
}

/** Step 1: e-mail a 6-digit code (no deep links needed, works the same in the app and on the web). */
export async function sendCode(email: string) {
  if (!supabase) throw new Error("ยังไม่ได้ตั้งค่าระบบออนไลน์");
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(error.message);
  useAuth.setState({ pendingEmail: email });
}

/** Step 2: verify the code from the e-mail. */
export async function verifyCode(code: string) {
  const email = useAuth.getState().pendingEmail;
  if (!supabase || !email) throw new Error("กรุณาขอรหัสใหม่");
  const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
  if (error) throw new Error("รหัสไม่ถูกต้องหรือหมดอายุ — ตรวจอีกครั้งหรือขอรหัสใหม่");
  useAuth.setState({ pendingEmail: null });
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export async function updateHandle(handle: string) {
  const s = useAuth.getState();
  if (!supabase || !s.session) return;
  const clean = handle.trim().toLowerCase().replace(/[^a-z0-9._ก-๙]/g, "").slice(0, 24);
  if (clean.length < 3) throw new Error("ชื่อต้องยาวอย่างน้อย 3 ตัว");
  const { error } = await supabase.from("profiles").update({ handle: clean }).eq("id", s.session.user.id);
  if (error) throw new Error(error.code === "23505" ? "ชื่อนี้มีคนใช้แล้ว" : error.message);
  await loadProfile(s.session.user.id);
}

export function currentUserId() {
  return useAuth.getState().session?.user.id ?? null;
}
