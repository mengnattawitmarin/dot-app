import { useEffect, useState } from "react";
import { cloudEnabled } from "@/lib/config";
import { fetchNotices, markNoticesRead, type Notice } from "@/lib/cloud";
import { useAuth } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { hashPalette } from "@/components/art";
import { askSignIn } from "@/components/account";
import { CloseIcon, CommentIcon, HeartIcon } from "@/components/icons";

const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
function ago(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  if (s > -60) return "เมื่อสักครู่";
  if (s > -3600) return rtf.format(Math.round(s / 60), "minute");
  if (s > -86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

/** Unread count for the bell badge. */
export function useUnreadCount() {
  const session = useAuth((s) => s.session);
  const version = useApp((s) => s.noticesVersion);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!session) return setN(0);
    void fetchNotices().then((list) => setN(list.filter((x) => !x.read).length));
  }, [session, version]);
  return n;
}

export function NoticesSheet() {
  const open = useApp((s) => s.noticesOpen);
  const session = useAuth((s) => s.session);
  const [list, setList] = useState<Notice[] | null>(null);

  useEffect(() => {
    if (!open || !session) return;
    setList(null);
    void fetchNotices().then((l) => {
      setList(l);
      if (l.some((x) => !x.read)) void markNoticesRead().then(() => useApp.getState().bumpNotices());
    });
  }, [open, session]);

  if (!open) return null;
  const close = () => useApp.getState().setNoticesOpen(false);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/50" onClick={close}>
      <div className="rise safe-bottom flex max-h-[75%] flex-col rounded-t-3xl bg-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="text-base font-semibold">การแจ้งเตือน</p>
          <button type="button" onClick={close} aria-label="ปิด" className="grid size-9 place-items-center text-muted">
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="no-scrollbar overflow-y-auto px-5 py-2">
          {!cloudEnabled ? (
            <p className="py-10 text-center text-sm text-muted">ยังไม่มีการแจ้งเตือนใหม่</p>
          ) : !session ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted">เข้าสู่ระบบเพื่อดูว่าใครถูกใจหรือคอมเมนต์คลิปของคุณ</p>
              <button
                type="button"
                onClick={() => {
                  close();
                  askSignIn();
                }}
                className="mt-4 h-10 rounded-full bg-gold-grad px-5 text-sm font-semibold text-accent-fg"
              >
                เข้าสู่ระบบ
              </button>
            </div>
          ) : list === null ? (
            <p className="py-10 text-center text-sm text-muted">กำลังโหลด…</p>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">ยังไม่มีการแจ้งเตือน โพสต์คลิปแรกใน Clipper เลย!</p>
          ) : (
            <ul>
              {list.map((n) => {
                const who = n.actor?.handle ?? "Do.T";
                const [a, b] = hashPalette(who);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        if (n.clip_id) useApp.getState().setTab("clipper");
                      }}
                      className="flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span className="relative">
                        <span className="grid size-10 place-items-center rounded-full text-xs font-bold" style={{ background: `linear-gradient(140deg, ${a}, ${b})` }}>
                          {who.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-bg text-gold">
                          {n.kind === "like" ? <HeartIcon size={12} filled className="text-live" /> : <CommentIcon size={12} />}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">
                          <b>@{who}</b> {n.kind === "like" ? "ถูกใจคลิปของคุณ" : n.kind === "comment" ? "คอมเมนต์คลิปของคุณ" : ""}
                          {n.body ? <span className="text-muted"> “{n.body}”</span> : null}
                        </span>
                        <span className="block text-xs text-faint">{ago(n.created_at)}</span>
                      </span>
                      {!n.read ? <span className="size-2 rounded-full bg-gold" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
