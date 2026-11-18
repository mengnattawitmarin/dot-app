import { useEffect, useState } from "react";
import { getEpisode, formatClock, nextEpisodeKey } from "@/lib/stories";
import { isDharmaShow, openAlbumLater } from "@/lib/dharma";
import { cycleRate, playEpisode, seekEpisode, skipEpisode, toggleEpisode, useEpisodeUi } from "@/lib/episode-player";
import { openExternal, shareContent } from "@/lib/share";
import { useApp } from "@/lib/store";
import { ChevronDown, HeartIcon, PauseIcon, PlayIcon, ShareIcon, SkipBack, SkipForward } from "@/components/icons";
import { EpisodeCover } from "@/components/dharma-view";

const SLEEP = [15, 30, 60];

/** Full-screen player for a story episode: cover, scrubber, ±15/30 s, speed, sleep timer. */
export function EpisodeNow({ episodeKey }: { episodeKey: string }) {
  const item = getEpisode(episodeKey);
  const playing = useApp((s) => s.playing && s.output === "radio");
  const favorites = useApp((s) => s.favorites);
  const sleepEndsAt = useApp((s) => s.sleepEndsAt);
  const { position, duration, rate, buffering } = useEpisodeUi();
  const [drag, setDrag] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [left, setLeft] = useState("");

  useEffect(() => {
    if (!sleepEndsAt) return setLeft("");
    const tick = () => {
      const ms = sleepEndsAt - Date.now();
      setLeft(ms > 0 ? formatClock(ms / 1000) : "");
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sleepEndsAt]);

  if (!item) return null;
  const { show, episode } = item;
  const saved = favorites.includes(show.id);
  const shown = drag ?? position;
  const total = duration || episode.duration;
  const dharma = isDharmaShow(show.id);
  const index = show.episodes.findIndex((e) => e.id === episode.id);
  const prevKey = index > 0 ? `${show.id}:${show.episodes[index - 1]!.id}` : null;
  const nextKey = nextEpisodeKey(episodeKey);

  return (
    <div className="safe-top safe-bottom absolute inset-0 z-30 flex flex-col overflow-y-auto bg-bg px-5 pb-6">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 50% at 50% 20%, rgba(214,168,86,0.16), transparent 70%)" }} />
      <div className="relative flex items-center justify-between pt-2">
        <button type="button" onClick={() => useApp.getState().setNowOpen(false)} className="grid size-11 place-items-center" aria-label="ปิด">
          <ChevronDown size={26} />
        </button>
        <p className="text-xs tracking-[0.2em] text-gold-light">{dharma ? "Do.T ธรรมะ" : "Do.T เรื่องเล่า"}</p>
        <button
          type="button"
          aria-label={saved ? "เลิกติดตามรายการ" : "ติดตามรายการ"}
          aria-pressed={saved}
          onClick={() => useApp.getState().toggleFavorite(show.id)}
          className={saved ? "grid size-11 place-items-center text-gold" : "grid size-11 place-items-center"}
        >
          <HeartIcon size={22} filled={saved} />
        </button>
      </div>

      <div className="relative mt-4 flex flex-col items-center">
        <EpisodeCover show={show} image={episode.image} className="size-60 rounded-3xl shadow-[0_20px_60px_-15px_rgba(214,168,86,0.45)]" />
        <h2 className="mt-6 line-clamp-2 text-center text-xl font-semibold leading-snug">{episode.title}</h2>
        <button
          type="button"
          onClick={() => {
            useApp.getState().setNowOpen(false);
            if (dharma) {
              openAlbumLater(show.id);
              useApp.getState().setTab("dharma");
              return;
            }
            useApp.getState().setTab("stories");
            window.dispatchEvent(new CustomEvent("dot:open-show", { detail: show.id }));
          }}
          className="mt-1 text-sm text-gold-light"
        >
          {show.name}
        </button>
        {episode.desc ? (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 text-left">
            <p className={expanded ? "text-sm text-muted" : "line-clamp-2 text-sm text-muted"}>{episode.desc}</p>
          </button>
        ) : null}
      </div>

      <div className="relative mt-6">
        <input
          className="gold-range"
          type="range"
          min={0}
          max={Math.max(1, Math.floor(total))}
          step={1}
          value={Math.floor(shown)}
          aria-label="ตำแหน่ง"
          onChange={(e) => setDrag(Number(e.target.value))}
          onPointerUp={() => {
            if (drag !== null) seekEpisode(drag);
            setDrag(null);
          }}
          onKeyUp={() => {
            if (drag !== null) seekEpisode(drag);
            setDrag(null);
          }}
        />
        <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-faint">
          <span>{formatClock(shown)}</span>
          <span>{buffering && playing ? "กำลังโหลด…" : ""}</span>
          <span>-{formatClock(Math.max(0, total - shown))}</span>
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-center gap-5">
        {dharma ? (
          <button type="button" disabled={!prevKey} onClick={() => prevKey && void playEpisode(prevKey)} aria-label="ตอนก่อนหน้า" className="grid size-10 place-items-center text-gold-light disabled:opacity-30">
            <SkipBack size={22} />
          </button>
        ) : null}
        <button type="button" onClick={() => skipEpisode(-15)} aria-label="ย้อน 15 วินาที" className="grid size-14 place-items-center rounded-full text-gold-light">
          <span className="text-lg font-semibold">↺15</span>
        </button>
        <button
          type="button"
          aria-label={playing ? "หยุดชั่วคราว" : "เล่น"}
          onClick={() => void toggleEpisode()}
          className="grid size-[72px] place-items-center rounded-full bg-gold-grad text-accent-fg shadow-[0_10px_40px_-8px_rgba(214,168,86,0.7)]"
        >
          {playing ? <PauseIcon size={30} /> : <PlayIcon size={30} className="translate-x-0.5" />}
        </button>
        <button type="button" onClick={() => skipEpisode(30)} aria-label="ข้ามไป 30 วินาที" className="grid size-14 place-items-center rounded-full text-gold-light">
          <span className="text-lg font-semibold">30↻</span>
        </button>
        {dharma ? (
          <button type="button" disabled={!nextKey} onClick={() => nextKey && void playEpisode(nextKey)} aria-label="ตอนถัดไป" className="grid size-10 place-items-center text-gold-light disabled:opacity-30">
            <SkipForward size={22} />
          </button>
        ) : null}
      </div>

      <div className="relative mt-6 flex items-center justify-between gap-2">
        <button type="button" onClick={cycleRate} className="h-9 min-w-14 rounded-full bg-subtle px-3 text-sm font-semibold text-gold-light ring-gold">
          {rate}×
        </button>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">{left ? `ปิดใน ${left}` : "ตั้งเวลาปิด"}</span>
          {SLEEP.map((m) => (
            <button key={m} type="button" onClick={() => useApp.getState().setSleepMinutes(m)} className="h-8 rounded-full bg-subtle px-2.5 text-xs ring-gold">
              {m}
            </button>
          ))}
          {sleepEndsAt ? (
            <button type="button" onClick={() => useApp.getState().setSleepMinutes(null)} className="h-8 rounded-full bg-gold-grad px-2.5 text-xs text-accent-fg">
              ปิด
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative mt-5 flex justify-center gap-2">
        <button
          type="button"
          onClick={() =>
            void shareContent({
              title: "Do.T",
              text: `🎧 ${episode.title}\nจากรายการ ${show.name} — ฟังบน Do.T`,
              url: show.link || undefined,
            })
          }
          className="flex h-9 items-center gap-1.5 rounded-full bg-subtle px-4 text-sm text-gold-light ring-gold"
        >
          <ShareIcon size={16} /> แชร์
        </button>
        {show.link ? (
          <button type="button" onClick={() => openExternal(show.link)} className="h-9 rounded-full bg-subtle px-4 text-sm text-muted ring-gold">
            เว็บไซต์รายการ
          </button>
        ) : null}
      </div>
    </div>
  );
}
