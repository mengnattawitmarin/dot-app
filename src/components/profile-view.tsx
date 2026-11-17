import { useState, type ReactNode } from "react";
import { channels, clips, getChannel, getClip, getStation, getTitle, stations, titles } from "@/lib/catalog";
import { openChannel, openTitle } from "@/lib/actions";
import { playStation } from "@/lib/player";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ChevronRight, MoonIcon, ShareIcon, WifiOffIcon } from "@/components/icons";
import { AccountCard, PushToggle } from "@/components/account";
import { Logo } from "@/components/ui";

export function ProfileView() {
  const favorites = useApp((s) => s.favorites);
  const recent = useApp((s) => s.recent);
  const forced = useApp((s) => s.forcedOffline);
  const online = useApp((s) => s.online);
  const sleepEndsAt = useApp((s) => s.sleepEndsAt);

  const saved = [
    ...stations.filter((s) => favorites.includes(s.id)).map((s) => ({ id: s.id, label: s.name, kind: "วิทยุ" })),
    ...channels.filter((c) => favorites.includes(c.id)).map((c) => ({ id: c.id, label: c.name, kind: "ทีวี" })),
    ...titles.filter((t) => favorites.includes(t.id)).map((t) => ({ id: t.id, label: t.name, kind: "หนัง" })),
    ...clips.filter((c) => favorites.includes(c.id)).map((c) => ({ id: c.id, label: c.caption, kind: "คลิป" })),
  ];
  const recentItems = recent
    .map((id) => {
      const s = getStation(id);
      if (s) return { id, label: s.name, kind: "วิทยุ" };
      const c = getChannel(id);
      if (c) return { id, label: c.name, kind: "ทีวี" };
      const t = getTitle(id);
      if (t) return { id, label: t.name, kind: "หนัง" };
      return null;
    })
    .filter((x): x is { id: string; label: string; kind: string } => Boolean(x));

  function open(id: string) {
    const s = getStation(id);
    if (s) return void playStation(s);
    if (getChannel(id)) return openChannel(id);
    if (getTitle(id)) return openTitle(id);
    if (getClip(id)) return useApp.getState().setTab("clipper");
  }

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-8">
      <AccountCard />

      <Shelf title="รายการโปรด" empty="กดหัวใจที่สถานีหรือช่อง แล้วจะมาอยู่ตรงนี้">
        {saved.map((x) => (
          <Row key={x.id} label={x.label} meta={x.kind} onClick={() => open(x.id)} />
        ))}
      </Shelf>

      <Shelf title="เล่นล่าสุด" empty="ยังไม่มีประวัติ">
        {recentItems.map((x) => (
          <Row key={x.id} label={x.label} meta={x.kind} onClick={() => open(x.id)} />
        ))}
      </Shelf>

      <section className="mt-7">
        <h2 className="mb-2 text-xs text-faint">ตั้งค่า</h2>
        <div className="divide-y divide-line rounded-2xl bg-elevated">
          <PushToggle />
          <button
            type="button"
            onClick={() => {
              if (!online && forced) return useApp.getState().toast("ยังไม่มีอินเทอร์เน็ต");
              useApp.getState().setForcedOffline(!forced);
            }}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <WifiOffIcon size={20} className="text-gold" />
            <span className="flex-1">
              <span className="block text-sm">โหมดในเครื่อง</span>
              <span className="block text-xs text-muted">ประหยัดเน็ต — เล่นเฉพาะสตูดิโอและช่องที่สร้างในแอป</span>
            </span>
            <Toggle on={forced} />
          </button>
          <div className="flex items-center gap-3 p-4">
            <MoonIcon size={20} className="text-gold" />
            <span className="flex-1 text-sm">ตั้งเวลาปิดเสียง</span>
            <div className="flex gap-1.5">
              {[15, 30, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    useApp.getState().setSleepMinutes(m);
                    useApp.getState().toast(`ปิดเสียงใน ${m} นาที`);
                  }}
                  className="h-8 rounded-full bg-subtle px-2.5 text-xs text-muted ring-gold"
                >
                  {m}
                </button>
              ))}
              {sleepEndsAt ? (
                <button
                  type="button"
                  onClick={() => useApp.getState().setSleepMinutes(null)}
                  className="h-8 rounded-full bg-gold-grad px-2.5 text-xs text-accent-fg"
                >
                  ปิด
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <SyncCard />

      <div className="mt-10 flex flex-col items-center gap-1">
        <Logo className="text-3xl" />
        <p className="text-[10px] tracking-[0.3em] text-gold-deep">LIVE YOUR MOMENT</p>
        <p className="mt-3 max-w-xs text-center text-[11px] leading-relaxed text-faint">
          สถานีและช่องทั้งหมดมาจากสตรีมสาธารณะที่เปิดให้เล่นข้ามแพลตฟอร์มได้ ภาพยนตร์เป็นผลงานลิขสิทธิ์เปิด (Blender
          Foundation) เวอร์ชัน 0.2
        </p>
      </div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={cn("relative h-6 w-11 rounded-full transition-colors", on ? "bg-gold" : "bg-line")}>
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-fg transition-all", on ? "left-[22px]" : "left-0.5")} />
    </span>
  );
}

function Shelf({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-xs text-faint">{title}</h2>
      {children.length === 0 ? (
        <p className="rounded-2xl bg-elevated p-4 text-sm text-muted">{empty}</p>
      ) : (
        <div className="divide-y divide-line rounded-2xl bg-elevated px-4">{children}</div>
      )}
    </section>
  );
}

function Row({ label, meta, onClick }: { label: string; meta: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-12 w-full items-center gap-3 text-left">
      <span className="flex-1 truncate text-sm">{label}</span>
      <span className="text-xs text-faint">{meta}</span>
      <ChevronRight size={16} className="text-faint" />
    </button>
  );
}

const PREFIX = "DOT1-";

export function encodeSync(ids: string[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(ids));
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return PREFIX + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeSync(code: string): string[] | null {
  const raw = code.trim();
  if (!raw.startsWith(PREFIX)) return null;
  try {
    const b64 = raw.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
    const ids = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string").slice(0, 200) : null;
  } catch {
    return null;
  }
}

/** Move favourites between devices with a short code — no account needed. */
function SyncCard() {
  const favorites = useApp((s) => s.favorites);
  const [input, setInput] = useState("");

  async function share() {
    const code = encodeSync(favorites);
    try {
      if (navigator.share) await navigator.share({ title: "รายการโปรด Do.T", text: code });
      else {
        await navigator.clipboard.writeText(code);
        useApp.getState().toast("คัดลอกโค้ดแล้ว");
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  function apply() {
    const ids = decodeSync(input);
    if (!ids) return useApp.getState().toast("โค้ดไม่ถูกต้อง");
    useApp.getState().importFavorites(ids);
    setInput("");
    useApp.getState().toast(`เพิ่ม ${ids.length} รายการโปรดแล้ว`);
  }

  return (
    <section className="mt-7">
      <h2 className="mb-2 text-xs text-faint">ย้ายรายการโปรดไปเครื่องอื่น</h2>
      <div className="rounded-2xl bg-elevated p-4">
        <button
          type="button"
          onClick={() => void share()}
          disabled={favorites.length === 0}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-subtle text-sm text-gold-light ring-gold disabled:opacity-40"
        >
          <ShareIcon size={18} /> ส่งโค้ดรายการโปรด ({favorites.length})
        </button>
        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="วางโค้ด DOT1-…"
            className="h-11 min-w-0 flex-1 rounded-xl bg-subtle px-3 text-sm text-fg outline-none placeholder:text-faint focus:ring-2 focus:ring-gold"
          />
          <button type="button" onClick={apply} className="h-11 rounded-xl bg-gold-grad px-4 text-sm font-medium text-accent-fg">
            นำเข้า
          </button>
        </div>
      </div>
    </section>
  );
}
