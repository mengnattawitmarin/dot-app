import { useEffect, useMemo, useState } from "react";
import {
  continueListening,
  episodeKey,
  formatDuration,
  getShow,
  loadStories,
  useStories,
  type Show,
} from "@/lib/stories";
import { playEpisode } from "@/lib/episode-player";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { hashPalette } from "@/components/art";
import { ChevronLeft, HeartIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { Chip, SectionHeader } from "@/components/ui";

/** Podcast cover with a generated fallback while it loads or if it fails. */
export function CoverImage({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const [a, b] = hashPalette(name);
  return (
    <span
      className={cn("relative block shrink-0 overflow-hidden rounded-xl", className)}
      style={{ background: `linear-gradient(150deg, ${a}, ${b})` }}
    >
      <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs font-semibold text-fg/80">{name.slice(0, 18)}</span>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

function timeAgo(ms: number) {
  if (!ms) return "";
  const days = Math.floor((Date.now() - ms) / 864e5);
  if (days < 1) return "วันนี้";
  if (days < 7) return `${days} วันก่อน`;
  return new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

export function StoriesView() {
  const { status, categories, shows, progress } = useStories();
  const favorites = useApp((s) => s.favorites);
  const [cat, setCat] = useState("all");
  const [openShow, setOpenShow] = useState<string | null>(null);

  useEffect(() => {
    void loadStories();
    const onOpen = (e: Event) => setOpenShow((e as CustomEvent<string>).detail);
    window.addEventListener("dot:open-show", onOpen);
    return () => window.removeEventListener("dot:open-show", onOpen);
  }, []);

  const resume = useMemo(() => continueListening(progress), [progress, shows]);
  const following = shows.filter((s) => favorites.includes(s.id));
  const visible = cat === "all" ? shows : shows.filter((s) => s.category === cat);
  const show = openShow ? getShow(openShow) : undefined;

  if (show) return <ShowDetail show={show} onBack={() => setOpenShow(null)} />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          type="button"
          onClick={() => useApp.getState().setTab("home")}
          className="grid size-9 place-items-center rounded-full bg-subtle text-gold ring-gold"
          aria-label="กลับหน้าหลัก"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold">เรื่องเล่า</h1>
          <p className="text-[11px] text-muted">สยองขวัญ · ความรู้ · นิยายเสียง · ภาพยนตร์เสียง</p>
        </div>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>
          ทั้งหมด
        </Chip>
        {categories
          .filter((c) => shows.some((s) => s.category === c.id))
          .map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              {c.label}
            </Chip>
          ))}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {status !== "ready" && shows.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-sm text-muted">{status === "error" ? "โหลดรายการไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่" : "กำลังโหลดเรื่องเล่า…"}</p>
            {status === "error" ? (
              <button
                type="button"
                onClick={() => void loadStories()}
                className="mt-4 h-10 rounded-full bg-gold-grad px-5 text-sm font-semibold text-accent-fg"
              >
                ลองใหม่
              </button>
            ) : null}
          </div>
        ) : null}

        {cat === "all" && resume.length > 0 ? (
          <section className="mb-6">
            <SectionHeader title="ฟังต่อ" />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {resume.map(({ key, p, item }) => (
                <button key={key} type="button" onClick={() => void playEpisode(key)} className="w-36 shrink-0 text-left">
                  <span className="relative block">
                    <CoverImage src={item.episode.image || item.show.image} name={item.show.name} className="aspect-square w-full" />
                    <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-black/50">
                      <span className="block h-full bg-gold" style={{ width: `${p.d ? Math.min(100, (p.t / p.d) * 100) : 0}%` }} />
                    </span>
                  </span>
                  <span className="mt-1.5 line-clamp-2 block text-xs leading-snug">{item.episode.title}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {cat === "all" && following.length > 0 ? (
          <section className="mb-6">
            <SectionHeader title="รายการที่ติดตาม" />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {following.map((s) => (
                <ShowCard key={s.id} show={s} onOpen={() => setOpenShow(s.id)} />
              ))}
            </div>
          </section>
        ) : null}

        {cat === "all"
          ? categories
              .filter((c) => shows.some((s) => s.category === c.id))
              .map((c) => (
                <section key={c.id} className="mb-6">
                  <SectionHeader title={c.label} onAction={() => setCat(c.id)} />
                  <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                    {shows
                      .filter((s) => s.category === c.id)
                      .map((s) => (
                        <ShowCard key={s.id} show={s} onOpen={() => setOpenShow(s.id)} />
                      ))}
                  </div>
                </section>
              ))
          : (
            <div className="grid grid-cols-3 gap-3">
              {visible.map((s) => (
                <ShowCard key={s.id} show={s} onOpen={() => setOpenShow(s.id)} grid />
              ))}
            </div>
          )}

        {shows.length > 0 ? (
          <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">
            รายการทั้งหมดเป็นพอดแคสต์สาธารณะ เล่นตรงจากผู้เผยแพร่แต่ละราย · อัปเดตตอนใหม่ทุกวัน
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ShowCard({ show, onOpen, grid = false }: { show: Show; onOpen: () => void; grid?: boolean }) {
  return (
    <button type="button" onClick={onOpen} className={cn("text-left", grid ? "" : "w-32 shrink-0")}>
      <CoverImage src={show.image} name={show.name} className="aspect-square w-full" />
      <span className="mt-1.5 line-clamp-2 block text-xs font-medium leading-snug">{show.name}</span>
      <span className="block truncate text-[10px] text-faint">{timeAgo(show.episodes[0]?.date ?? 0)}</span>
    </button>
  );
}

function ShowDetail({ show, onBack }: { show: Show; onBack: () => void }) {
  const favorites = useApp((s) => s.favorites);
  const nowId = useApp((s) => (s.now?.kind === "episode" ? s.now.id : null));
  const playing = useApp((s) => s.playing && s.output === "radio");
  const progress = useStories((s) => s.progress);
  const followed = favorites.includes(show.id);
  const [more, setMore] = useState(false);

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-6">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-gold" aria-label="กลับ">
        <ChevronLeft size={18} /> เรื่องเล่า
      </button>
      <div className="flex gap-4">
        <CoverImage src={show.image} name={show.name} className="size-32" />
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-3 text-lg font-semibold leading-snug">{show.name}</h1>
          {show.author ? <p className="mt-1 truncate text-xs text-muted">{show.author}</p> : null}
          <div className="mt-3 flex gap-2">
            {show.episodes[0] ? (
              <button
                type="button"
                onClick={() => void playEpisode(episodeKey(show, show.episodes[0]!))}
                className="flex h-9 items-center gap-1.5 rounded-full bg-gold-grad px-4 text-sm font-semibold text-accent-fg"
              >
                <PlayIcon size={14} /> ตอนล่าสุด
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => useApp.getState().toggleFavorite(show.id)}
              aria-pressed={followed}
              className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-sm ring-gold", followed ? "bg-subtle text-gold" : "bg-subtle text-muted")}
            >
              <HeartIcon size={16} filled={followed} /> {followed ? "ติดตามแล้ว" : "ติดตาม"}
            </button>
          </div>
        </div>
      </div>
      {show.desc ? (
        <button type="button" onClick={() => setMore((v) => !v)} className="mt-4 block text-left">
          <p className={more ? "text-sm text-muted" : "line-clamp-3 text-sm text-muted"}>{show.desc}</p>
        </button>
      ) : null}

      <h2 className="mb-2 mt-6 text-xs text-faint">{show.episodes.length} ตอนล่าสุด</h2>
      <ul className="divide-y divide-line">
        {show.episodes.map((ep) => {
          const key = episodeKey(show, ep);
          const current = key === nowId;
          const p = progress[key];
          const pct = p?.d ? Math.min(100, (p.t / p.d) * 100) : 0;
          return (
            <li key={ep.id}>
              <button type="button" onClick={() => void playEpisode(key)} className="flex w-full items-center gap-3 py-3 text-left">
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", current ? "bg-gold-grad text-accent-fg" : "bg-subtle text-gold ring-gold")}>
                  {current && playing ? <PauseIcon size={16} /> : <PlayIcon size={16} className="translate-x-px" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("line-clamp-2 block text-sm leading-snug", current && "text-gold-light")}>{ep.title}</span>
                  <span className="mt-0.5 block text-[11px] text-faint">
                    {[timeAgo(ep.date), formatDuration(ep.duration), pct >= 97 ? "ฟังจบแล้ว" : pct > 0 ? `ฟังไป ${Math.round(pct)}%` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {pct > 0 && pct < 97 ? (
                    <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-line">
                      <span className="block h-full bg-gold" style={{ width: `${pct}%` }} />
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
