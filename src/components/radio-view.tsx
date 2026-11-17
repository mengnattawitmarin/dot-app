import { useMemo, useState } from "react";
import { GENRE_LABEL, stationFreq, stations, type Station } from "@/lib/catalog";
import { StationArt } from "@/components/art";
import { playStation } from "@/lib/player";
import { selectOffline, useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { HeartIcon, SearchIcon } from "@/components/icons";
import { RadioHero } from "@/components/radio-hero";
import { Chip, Waveform } from "@/components/ui";

type FilterId = "fav" | "all" | "fm" | "cool" | "looktung" | "news" | "thai" | "intl" | "local";

const text = (s: Station) => `${s.name} ${s.blurb}`;

const FILTERS: Array<{ id: FilterId; label: string; test: (s: Station) => boolean }> = [
  { id: "all", label: "ทั้งหมด", test: () => true },
  { id: "fav", label: "★ โปรด", test: (s) => useApp.getState().favorites.includes(s.id) },
  { id: "fm", label: "FM 88–108", test: (s) => s.kind === "live" && stationFreq(s) !== null },
  { id: "cool", label: "COOL", test: (s) => /cool/i.test(s.name) },
  { id: "looktung", label: "ลูกทุ่ง", test: (s) => /ลูกทุ่ง|looktung|luktung|เพื่อชีวิต|เขียนกัน|บ้านใหม่|country/i.test(text(s)) },
  { id: "news", label: "ข่าว", test: (s) => /ข่าว|news|สนทนา|mcot|inn/i.test(text(s)) },
  { id: "thai", label: "ฮิตไทย", test: (s) => s.kind === "live" && s.genre === "thai" },
  { id: "intl", label: "สากล", test: (s) => s.kind === "live" && s.genre !== "thai" },
  { id: "local", label: "ในเครื่อง", test: (s) => s.kind === "studio" },
];

export function RadioView() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [q, setQ] = useState("");
  const version = useApp((s) => s.catalogVersion);
  const favorites = useApp((s) => s.favorites);
  const favStations = useMemo(
    () => favorites.map((id) => stations.find((s) => s.id === id)).filter((s): s is Station => Boolean(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [favorites, version],
  );
  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0]!;
    const term = q.trim().toLowerCase();
    const list = stations.filter((s) => f.test(s) && (!term || `${text(s)} ${s.city}`.toLowerCase().includes(term)));
    if (filter === "fm") list.sort((a, b) => Number(stationFreq(a)) - Number(stationFreq(b)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, q, version, favorites]);
  const onlineCount = stations.filter((s) => s.kind === "live").length;

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-6">
      <RadioHero />
      {favStations.length > 0 ? <FavoriteRow list={favStations} /> : null}
      <button
        type="button"
        onClick={() => useApp.getState().setTab("stories")}
        className="card-sheen mt-4 flex w-full items-center gap-3 rounded-2xl p-3 text-left"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-subtle text-xl">🎧</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">เรื่องเล่า & นิยายเสียง</span>
          <span className="block truncate text-xs text-muted">สยองขวัญ · ความรู้ · ประวัติศาสตร์ · ภาพยนตร์เสียง</span>
        </span>
        <span className="text-gold">›</span>
      </button>
      <label className="mt-4 flex h-11 items-center gap-2 rounded-xl bg-subtle px-3 ring-gold focus-within:ring-2 focus-within:ring-gold">
        <SearchIcon size={16} className="text-gold" />
        <span className="sr-only">ค้นหาสถานี</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`ค้นหาจาก ${onlineCount} สถานี เช่น 99, ลูกทุ่ง, ข่าว`}
          className="h-full flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
        />
      </label>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-faint">{visible.length} สถานี</p>
      <StationList list={visible} />
      {visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">{filter === "fav" ? "ยังไม่มีสถานีโปรด — กด ♡ ที่สถานีที่ชอบ" : "ไม่พบสถานี"}</p>
      ) : null}
    </div>
  );
}

export function StationList({ list }: { list: Station[] }) {
  const offline = useApp(selectOffline);
  const nowId = useApp((s) => (s.now?.kind === "station" ? s.now.id : null));
  const playing = useApp((s) => s.playing && s.output === "radio");
  const favorites = useApp((s) => s.favorites);

  return (
    <ul className="mt-4 flex flex-col gap-1">
      {list.map((station) => {
        const blocked = station.kind === "live" && offline;
        const current = station.id === nowId;
        const saved = favorites.includes(station.id);
        return (
          <li key={station.id}>
            <div className={cn("flex items-center gap-3 rounded-xl p-2", current && "card-sheen", blocked && "opacity-50")}>
              <button
                type="button"
                onClick={() => void playStation(station)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="relative shrink-0">
                  <StationArt station={station} className="size-12" />
                  {current && playing ? (
                    <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/55">
                      <Waveform active live={station.kind === "live"} bars={5} height={18} className="w-6" />
                    </span>
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-sm font-medium", current ? "text-gold-light" : "text-fg")}>
                    {station.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {station.kind === "live" && station.source ? station.blurb : `${station.blurb} · ${GENRE_LABEL[station.genre]}`}
                  </span>
                </span>
              </button>
              <span className="shrink-0 text-[11px] text-faint">
                {station.kind === "studio" ? "ในเครื่อง" : blocked ? "ต้องใช้เน็ต" : station.city}
              </span>
              <button
                type="button"
                aria-label={saved ? "เอาออกจากรายการโปรด" : "เพิ่มในรายการโปรด"}
                aria-pressed={saved}
                onClick={() => useApp.getState().toggleFavorite(station.id)}
                className={cn("grid size-10 place-items-center", saved ? "text-gold" : "text-faint")}
              >
                <HeartIcon size={20} filled={saved} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Horizontal row of favourite stations — one tap to play. */
export function FavoriteRow({ list, title = "สถานีโปรด" }: { list: Station[]; title?: string }) {
  const nowId = useApp((s) => (s.now?.kind === "station" ? s.now.id : null));
  const playing = useApp((s) => s.playing && s.output === "radio");
  return (
    <section className="mt-5">
      <h2 className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold">
        <HeartIcon size={16} filled className="text-gold" /> {title}
      </h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
        {list.map((st) => {
          const current = st.id === nowId;
          return (
            <button key={st.id} type="button" onClick={() => void playStation(st)} className="w-20 shrink-0 text-center">
              <span className={cn("relative mx-auto block size-20 rounded-2xl", current && "ring-2 ring-gold")}>
                <StationArt station={st} className="size-20 rounded-2xl" />
                {current && playing ? (
                  <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/50">
                    <Waveform active live={st.kind === "live"} bars={5} height={18} className="w-7" />
                  </span>
                ) : null}
              </span>
              <span className={cn("mt-1.5 line-clamp-2 block text-[11px] leading-tight", current ? "text-gold-light" : "text-muted")}>{st.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
