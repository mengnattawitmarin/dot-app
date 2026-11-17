import { useEffect, useState } from "react";
import { channels, titles, type TvChannel } from "@/lib/catalog";
import { openChannel, openTitle } from "@/lib/actions";
import { selectOffline, useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ChevronRight, HeartIcon } from "@/components/icons";
import { ChannelMark, LiveBadge, Poster, SectionHeader, Skyline } from "@/components/ui";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export function TvView() {
  const offline = useApp(selectOffline);
  const clock = useClock();
  const popular = channels.filter((c) => c.popular);
  const featured = popular[0];
  const local = channels.filter((c) => c.mode === "scene");
  const thai = channels.filter((c) => c.mode === "video" && c.region === "th");
  const world = channels.filter((c) => c.mode === "video" && c.region !== "th");
  const showAll = () => document.getElementById("all-channels")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-6">
      <SectionHeader title="ทีวีสด" onAction={showAll} />
      {featured ? (
        <button
          type="button"
          onClick={() => openChannel(offline ? (local[1] ?? featured) : featured)}
          className="card-sheen rise block w-full overflow-hidden rounded-2xl text-left"
        >
          <div className="relative aspect-video">
            <Skyline className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
            <ChannelMark name={featured.name} className="absolute bottom-3 left-3 size-14 bg-black/60" />
            <span className="absolute right-3 top-3">
              <LiveBadge />
            </span>
            <span className="absolute bottom-3 right-3 text-xs font-medium text-fg">{clock}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">รายการเด่น</p>
              <p className="truncate text-xs text-muted">
                ถ่ายทอดสดตอนนี้ · {featured.name} — {featured.blurb}
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-gold" />
          </div>
        </button>
      ) : null}

      <section className="mt-6">
        <SectionHeader title="ช่องยอดนิยม" onAction={showAll} />
        <div className="grid grid-cols-4 gap-2.5">
          {popular.map((c) => (
            <button key={c.id} type="button" onClick={() => openChannel(c)} aria-label={c.name} className={cn(offline && "opacity-50")}>
              <ChannelMark name={c.name} className="aspect-[4/3] w-full" />
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title="แนะนำสำหรับคุณ" />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
          {titles.map((t) => (
            <button key={t.id} type="button" onClick={() => openTitle(t.id)} className="w-36 shrink-0 text-left">
              <Poster title={t} className="aspect-[4/3] w-full" />
            </button>
          ))}
        </div>
      </section>

      <div id="all-channels" className="scroll-mt-2">
        <ChannelGroup title="ช่องไทย" items={thai} offline={offline} />
        <ChannelGroup title="ช่องต่างประเทศ" items={world} offline={offline} />
        <ChannelGroup title="ช่องในเครื่อง (ไม่ต้องใช้เน็ต)" items={local} offline={offline} />
      </div>
    </div>
  );
}

function ChannelGroup({ title, items, offline }: { title: string; items: TvChannel[]; offline: boolean }) {
  const favorites = useApp((s) => s.favorites);
  if (items.length === 0) return null;
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-xs font-medium tracking-wide text-faint">{title}</h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const blocked = item.mode === "video" && offline;
          const saved = favorites.includes(item.id);
          return (
            <li key={item.id} className={cn("flex items-center gap-3 rounded-xl p-2", blocked && "opacity-50")}>
              <button type="button" onClick={() => openChannel(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <ChannelMark name={item.name} className="h-11 w-16 shrink-0 text-[11px]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-muted">{blocked ? "ต้องใช้เน็ต" : item.blurb}</span>
                </span>
              </button>
              <button
                type="button"
                aria-label={saved ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
                aria-pressed={saved}
                onClick={() => useApp.getState().toggleFavorite(item.id)}
                className={cn("grid size-10 place-items-center", saved ? "text-gold" : "text-faint")}
              >
                <HeartIcon size={20} filled={saved} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
