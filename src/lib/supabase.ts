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
};

export const useAuth = create<AuthState>(() => ({ ready: !cloudEnabled, session: null, profile: null }));

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

function authError(message: string) {
  if (/invalid login credentials/i.test(message)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (/already registered|already exists/i.test(message)) return "อีเมลนี้สมัครแล้ว — กดแท็บเข้าสู่ระบบ";
  if (/password/i.test(message) && /6|short|weak/i.test(message)) return "รหัสผ่านต้องยาวอย่างน้อย 6 ตัว";
  if (/email not confirmed/i.test(message)) return "อีเมลยังไม่ได้ยืนยัน (ปิด Confirm email ใน Supabase)";
  if (/rate limit/i.test(message)) return "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  return message;
}

/** Email + password. No e-mail is sent when "Confirm email" is off in Supabase (free tier friendly). */
export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error("ยังไม่ได้ตั้งค่าระบบออนไลน์");
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(authError(error.message));
}

export async function signUp(email: string, password: string) {
  if (!supabase) throw new Error("ยังไม่ได้ตั้งค่าระบบออนไลน์");
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(authError(error.message));
  if (!data.session) throw new Error("สมัครแล้ว แต่ต้องยืนยันอีเมลก่อน — ให้ผู้ดูแลปิด Confirm email ใน Supabase");
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
