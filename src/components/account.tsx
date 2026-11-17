import { useEffect, useState } from "react";
import { create } from "zustand";
import { cloudEnabled } from "@/lib/config";
import { disablePush, enablePush, pushAvailable, pushWanted } from "@/lib/push";
import { signInWithPassword, signOut, signUp, updateHandle, useAuth } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { hashPalette } from "@/components/art";
import { BellIcon, CloseIcon, UserIcon } from "@/components/icons";

/** Global "please sign in" sheet, openable from anywhere (Clipper, comments, profile). */
export const useSignIn = create<{ open: boolean; reason: string | null }>(() => ({ open: false, reason: null }));
export const askSignIn = (reason?: string) => useSignIn.setState({ open: true, reason: reason ?? null });

export function AccountCard() {
  const session = useAuth((s) => s.session);
  const profile = useAuth((s) => s.profile);
  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState("");

  if (!cloudEnabled) {
    return (
      <div className="card-sheen flex items-center gap-4 rounded-2xl p-4">
        <span className="grid size-14 place-items-center rounded-full bg-subtle text-gold ring-gold">
          <UserIcon size={28} />
        </span>
        <div>
          <p className="text-lg font-semibold">ผู้ฟัง Do.T</p>
          <p className="text-xs text-muted">ใช้งานแบบในเครื่อง — ระบบบัญชีออนไลน์ยังไม่เปิด</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="card-sheen rounded-2xl p-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-subtle text-gold ring-gold">
            <UserIcon size={28} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">ยังไม่ได้เข้าสู่ระบบ</p>
            <p className="text-xs text-muted">เข้าสู่ระบบเพื่อโพสต์คลิป คอมเมนต์ และซิงก์รายการโปรดทุกเครื่อง</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => askSignIn()}
          className="mt-4 h-11 w-full rounded-xl bg-gold-grad text-sm font-semibold text-accent-fg"
        >
          เข้าสู่ระบบ / สมัครสมาชิก
        </button>
      </div>
    );
  }

  const name = profile?.handle ?? session.user.email ?? "ผู้ใช้";
  const [a, b] = hashPalette(name);
  return (
    <div className="card-sheen rounded-2xl p-4">
      <div className="flex items-center gap-4">
        <span
          className="grid size-14 place-items-center rounded-full font-display text-lg font-bold text-fg"
          style={{ background: `linear-gradient(140deg, ${a}, ${b})` }}
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateHandle(handle)
                  .then(() => setEditing(false))
                  .catch((err: Error) => useApp.getState().toast(err.message));
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="h-9 min-w-0 flex-1 rounded-lg bg-subtle px-2 text-sm outline-none focus:ring-2 focus:ring-gold"
              />
              <button type="submit" className="rounded-lg bg-gold-grad px-3 text-xs font-semibold text-accent-fg">
                บันทึก
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setHandle(profile?.handle ?? "");
                setEditing(true);
              }}
              className="text-left"
            >
              <p className="truncate text-lg font-semibold">@{name}</p>
              <p className="truncate text-xs text-muted">{session.user.email} · แตะเพื่อเปลี่ยนชื่อ</p>
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-gold-light">● ซิงก์รายการโปรดกับบัญชีแล้ว</p>
      <button
        type="button"
        onClick={() => void signOut().then(() => useApp.getState().toast("ออกจากระบบแล้ว"))}
        className="mt-3 h-9 w-full rounded-xl bg-subtle text-xs text-muted ring-gold"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}

export function PushToggle() {
  const session = useAuth((s) => s.session);
  const [on, setOn] = useState(false);
  useEffect(() => {
    void pushWanted().then(setOn);
  }, []);
  if (!pushAvailable) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (!session) return askSignIn("เข้าสู่ระบบเพื่อรับการแจ้งเตือนเมื่อมีคนถูกใจหรือคอมเมนต์คลิปของคุณ");
        if (on) {
          await disablePush();
          setOn(false);
        } else setOn(await enablePush());
      }}
      className="flex w-full items-center gap-3 p-4 text-left"
    >
      <BellIcon size={20} className="text-gold" />
      <span className="flex-1">
        <span className="block text-sm">การแจ้งเตือน</span>
        <span className="block text-xs text-muted">เมื่อมีคนถูกใจหรือคอมเมนต์คลิปของคุณ</span>
      </span>
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-gold" : "bg-line")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-fg transition-all", on ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function SignInSheet() {
  const open = useSignIn((s) => s.open);
  const reason = useSignIn((s) => s.reason);
  const session = useAuth((s) => s.session);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && open) {
      useSignIn.setState({ open: false, reason: null });
      setPassword("");
      useApp.getState().toast(mode === "up" ? "สมัครสมาชิกเรียบร้อย ยินดีต้อนรับ!" : "เข้าสู่ระบบแล้ว");
      setMode("in"); // next time the sheet opens on the sign-in tab
    }
  }, [session, open, mode]);

  if (!open) return null;
  const close = () => useSignIn.setState({ open: false, reason: null });

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") await signUp(email, password);
      else await signInWithPassword(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[60] flex flex-col justify-end bg-black/60" onClick={close}>
      <div className="rise safe-bottom rounded-t-3xl bg-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold">{mode === "up" ? "สมัครสมาชิก Do.T" : "เข้าสู่ระบบ Do.T"}</p>
          <button type="button" onClick={close} aria-label="ปิด" className="grid size-9 place-items-center text-muted">
            <CloseIcon size={20} />
          </button>
        </div>
        {reason ? <p className="mt-1 text-sm text-muted">{reason}</p> : null}

        <div className="mt-4 grid grid-cols-2 rounded-xl bg-subtle p-1">
          {(["in", "up"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={cn("h-9 rounded-lg text-sm", mode === m ? "bg-gold-grad font-semibold text-accent-fg" : "text-muted")}
            >
              {m === "in" ? "เข้าสู่ระบบ" : "สมัครใหม่"}
            </button>
          ))}
        </div>

        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="text-xs text-faint" htmlFor="si-email">
            อีเมล
          </label>
          <input
            id="si-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 h-12 w-full rounded-xl bg-subtle px-4 text-base text-fg outline-none focus:ring-2 focus:ring-gold"
          />
          <label className="mt-3 block text-xs text-faint" htmlFor="si-pass">
            รหัสผ่าน {mode === "up" ? "(อย่างน้อย 6 ตัว)" : ""}
          </label>
          <div className="relative mt-1">
            <input
              id="si-pass"
              type={show ? "text" : "password"}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 w-full rounded-xl bg-subtle pl-4 pr-16 text-base text-fg outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-lg px-2 text-xs text-muted"
            >
              {show ? "ซ่อน" : "แสดง"}
            </button>
          </div>
          <button
            disabled={busy || password.length < 6 || !email}
            className="mt-5 h-12 w-full rounded-xl bg-gold-grad font-semibold text-accent-fg disabled:opacity-50"
          >
            {busy ? "กำลังดำเนินการ…" : mode === "up" ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
          </button>
          {mode === "up" ? (
            <p className="mt-3 text-center text-xs text-faint">การสมัครถือว่ายอมรับให้คลิปที่โพสต์สาธารณะแสดงต่อผู้ใช้ Do.T คนอื่น</p>
          ) : null}
        </form>
        {error ? <p className="mt-3 text-center text-sm text-live">{error}</p> : null}
      </div>
    </div>
  );
}
