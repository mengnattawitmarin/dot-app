import { useEffect, useState } from "react";
import { getStation, stationQueue } from "@/lib/catalog";
import { StationArt } from "@/components/art";
import { applyVolume, stepStation, toggleRadio } from "@/lib/player";
import { selectOffline, useApp } from "@/lib/store";
import { ChevronDown, HeartIcon, PauseIcon, PlayIcon, SkipBack, SkipForward, VolumeIcon } from "@/components/icons";
import { LiveBadge, Waveform } from "@/components/ui";

const SLEEP = [15, 30, 60];

export function NowScreen() {
  const open = useApp((s) => s.nowOpen);
  const now = useApp((s) => s.now);
  const playing = useApp((s) => s.playing && s.output === "radio");
  const volume = useApp((s) => s.volume);
  const muted = useApp((s) => s.muted);
  const favorites = useApp((s) => s.favorites);
  const sleepEndsAt = useApp((s) => s.sleepEndsAt);
  const offline = useApp(selectOffline);
  const [left, setLeft] = useState("");

  useEffect(() => {
    if (!sleepEndsAt) {
      setLeft("");
      return;
    }
    const tick = () => {
      const ms = sleepEndsAt - Date.now();
      if (ms <= 0) return setLeft("");
      setLeft(`${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sleepEndsAt]);

  if (!open || !now) return null;
  const station = getStation(now.id);
  if (!station) return null;
  const saved = favorites.includes(station.id);
  const queue = stationQueue(offline);
  const live = station.kind === "live";

  return (
    <div className="safe-top safe-bottom absolute inset-0 z-30 flex flex-col bg-bg px-5 pb-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(90% 50% at 50% 20%, rgba(214,168,86,0.18), transparent 70%)" }}
      />
      <div className="relative flex items-center justify-between pt-2">
        <button type="button" onClick={() => useApp.getState().setNowOpen(false)} className="grid size-11 place-items-center" aria-label="ปิด">
          <ChevronDown size={26} />
        </button>
        <p className="text-xs tracking-[0.2em] text-gold-light">Do.T RADIO</p>
        <button
          type="button"
          aria-label={saved ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
          aria-pressed={saved}
          onClick={() => useApp.getState().toggleFavorite(station.id)}
          className={saved ? "grid size-11 place-items-center text-gold" : "grid size-11 place-items-center"}
        >
          <HeartIcon size={22} filled={saved} />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center">
        <StationArt station={station} size="lg" className="size-56 rounded-3xl shadow-[0_20px_60px_-15px_rgba(214,168,86,0.45)]" />
        <div className="mt-7 flex items-center gap-2">
          <h2 className="text-center text-2xl font-semibold">{station.name}</h2>
          {live ? <LiveBadge /> : null}
        </div>
        <p className="mt-1.5 text-center text-sm text-muted">
          {station.blurb} · {station.city}
        </p>
        <Waveform active={playing} live={live} className="mt-8 w-full" height={56} />
      </div>

      <div className="relative flex items-center justify-center gap-8">
        <button type="button" aria-label="สถานีก่อนหน้า" onClick={() => void stepStation(-1, queue)} className="grid size-12 place-items-center text-gold-light">
          <SkipBack size={28} />
        </button>
        <button
          type="button"
          aria-label={playing ? "หยุดชั่วคราว" : "เล่น"}
          onClick={() => void toggleRadio()}
          className="grid size-[72px] place-items-center rounded-full bg-gold-grad text-accent-fg shadow-[0_10px_40px_-8px_rgba(214,168,86,0.7)]"
        >
          {playing ? <PauseIcon size={30} /> : <PlayIcon size={30} className="translate-x-0.5" />}
        </button>
        <button type="button" aria-label="สถานีถัดไป" onClick={() => void stepStation(1, queue)} className="grid size-12 place-items-center text-gold-light">
          <SkipForward size={28} />
        </button>
      </div>

      <div className="relative mt-7 flex items-center gap-3">
        <button
          type="button"
          aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
          onClick={() => {
            useApp.getState().toggleMute();
            applyVolume();
          }}
          className="grid size-10 place-items-center text-muted"
        >
          <VolumeIcon size={20} muted={muted} />
        </button>
        <input
          className="gold-range"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          aria-label="ความดัง"
          onChange={(e) => {
            useApp.getState().setVolume(Number(e.target.value));
            applyVolume();
          }}
        />
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{left ? `ปิดเองใน ${left}` : "ตั้งเวลาปิด"}</p>
        <div className="flex gap-2">
          {SLEEP.map((m) => (
            <button key={m} type="button" onClick={() => useApp.getState().setSleepMinutes(m)} className="h-8 rounded-full bg-subtle px-3 text-xs ring-gold">
              {m} นาที
            </button>
          ))}
          {sleepEndsAt ? (
            <button type="button" onClick={() => useApp.getState().setSleepMinutes(null)} className="h-8 rounded-full bg-gold-grad px-3 text-xs text-accent-fg">
              ปิด
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
