import { getStation } from "@/lib/catalog";
import { playStation, toggleRadio } from "@/lib/player";
import { selectOffline, useApp } from "@/lib/store";
import { HeartIcon, MusicIcon, PauseIcon, PlayIcon } from "@/components/icons";
import { splitSong } from "@/lib/now-playing";
import { SongActions } from "@/components/song-actions";
import { LiveBadge, Waveform } from "@/components/ui";

/** Abstract studio-mic artwork (gold rim light), drawn in SVG. */
function MicArt() {
  return (
    <svg viewBox="0 0 200 240" className="pointer-events-none absolute -right-12 top-2 h-[78%] w-auto opacity-70" aria-hidden="true">
      <defs>
        <radialGradient id="glow" cx="65%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#d6a856" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#d6a856" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6dc9c" />
          <stop offset="100%" stopColor="#7a5a26" />
        </linearGradient>
        <pattern id="mesh" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1" fill="#d6a856" opacity="0.35" />
        </pattern>
      </defs>
      <circle cx="130" cy="80" r="110" fill="url(#glow)" />
      <g transform="rotate(-18 120 90)">
        <rect x="88" y="20" width="64" height="104" rx="32" fill="#14110c" stroke="url(#rim)" strokeWidth="2.5" />
        <rect x="94" y="26" width="52" height="92" rx="26" fill="url(#mesh)" />
        <path d="M76 92a44 44 0 0 0 88 0" fill="none" stroke="url(#rim)" strokeWidth="3" strokeLinecap="round" />
        <path d="M120 136v38M96 176h48" stroke="url(#rim)" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function RadioHero({ compact = false }: { compact?: boolean }) {
  const offline = useApp(selectOffline);
  const now = useApp((s) => s.now);
  const playing = useApp((s) => s.playing && s.output === "radio");
  const station = (now ? getStation(now.id) : undefined) ?? getStation(offline ? "studio-drive" : "th-cool");
  const isCurrent = Boolean(now && station && now.id === station.id);
  const songRaw = useApp((s) => s.songTitle); // select the string, not a new object, to avoid re-render loops
  const song = isCurrent ? splitSong(songRaw) : null;
  const live = station?.kind === "live";
  const saved = useApp((s) => (station ? s.favorites.includes(station.id) : false));

  function onPlay() {
    if (!station) return;
    if (isCurrent) void toggleRadio();
    else void playStation(station);
  }

  return (
    <section className="card-sheen relative overflow-hidden rounded-2xl p-4">
      <MicArt />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide text-gold-light">Do.T RADIO</p>
          {live ? <LiveBadge /> : <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[10px] text-muted">ในเครื่อง</span>}
        </div>
        <h1 className={compact ? "mt-8 text-2xl font-semibold leading-tight" : "mt-14 text-[28px] font-semibold leading-[1.15]"}>
          กลางคืนนี้
          <br />
          เป็นของคุณ
        </h1>
        <p className="mt-1.5 max-w-[60%] text-xs text-muted">สถานีไทย สถานีนอก และสตรีมออนไลน์</p>

        <p className="mt-5 text-[11px] text-faint">{isCurrent && playing ? "กำลังออกอากาศ" : "พร้อมออกอากาศ"}</p>
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-gold-light">{station?.name}</p>
          {station ? (
            <button
              type="button"
              onClick={() => useApp.getState().toggleFavorite(station.id)}
              aria-label={saved ? "เอาออกจากสถานีโปรด" : "เพิ่มเป็นสถานีโปรด"}
              aria-pressed={saved}
              className={saved ? "grid size-8 shrink-0 place-items-center text-gold" : "grid size-8 shrink-0 place-items-center text-muted"}
            >
              <HeartIcon size={18} filled={saved} />
            </button>
          ) : null}
        </div>
        {song ? (
          <p className="rise mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-fg">
            <MusicIcon size={14} className="shrink-0 text-gold" />
            <span className="truncate">
              <b className="font-semibold">{song.title}</b>
              {song.artist ? <span className="text-muted"> · {song.artist}</span> : null}
            </span>
          </p>
        ) : null}
        {song && station ? (
          <div className="relative mt-2">
            <SongActions station={station} song={song} compact />
          </div>
        ) : null}
        <Waveform active={isCurrent && playing} live={live} className="mt-2" />
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={onPlay}
            aria-label={isCurrent && playing ? "หยุดชั่วคราว" : "เล่น"}
            className="grid size-14 place-items-center rounded-full bg-gold-grad text-accent-fg shadow-[0_8px_30px_-6px_rgba(214,168,86,0.6)] active:scale-95"
          >
            {isCurrent && playing ? <PauseIcon size={24} /> : <PlayIcon size={24} className="translate-x-0.5" />}
          </button>
        </div>
      </div>
    </section>
  );
}
