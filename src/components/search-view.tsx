import { useMemo, useState } from "react";
import { channels, stations, titles } from "@/lib/catalog";
import { openChannel, openTitle } from "@/lib/actions";
import { SearchIcon } from "@/components/icons";
import { StationList } from "@/components/radio-view";
import { ChannelMark, Chip, Poster } from "@/components/ui";

const SUGGEST = ["COOL", "ลูกทุ่ง", "ข่าว", "แจ๊ส", "DLTV", "Sintel"];

export function SearchView() {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const result = useMemo(() => {
    if (!term) return null;
    const has = (s: string) => s.toLowerCase().includes(term);
    return {
      stations: stations.filter((s) => has(`${s.name} ${s.blurb} ${s.city}`)),
      channels: channels.filter((c) => has(`${c.name} ${c.blurb}`)),
      titles: titles.filter((t) => has(`${t.name} ${t.tagline}`)),
    };
  }, [term]);
  const empty = result && result.stations.length + result.channels.length + result.titles.length === 0;

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-6">
      <h1 className="text-xl font-semibold">ค้นหา</h1>
      <label className="mt-3 flex h-12 items-center gap-2 rounded-xl bg-subtle px-4 ring-gold focus-within:ring-2 focus-within:ring-gold">
        <SearchIcon size={18} className="text-gold" />
        <span className="sr-only">ค้นหา</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="สถานี ช่องทีวี หนัง…"
          className="h-full flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-faint"
          autoComplete="off"
        />
      </label>
      {!result ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGEST.map((s) => (
            <Chip key={s} onClick={() => setQ(s)}>
              {s}
            </Chip>
          ))}
        </div>
      ) : null}
      {empty ? <p className="mt-10 text-center text-sm text-muted">ไม่พบ “{q}”</p> : null}
      {result && result.titles.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-xs text-faint">หนัง</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {result.titles.map((t) => (
              <button key={t.id} type="button" onClick={() => openTitle(t.id)}>
                <Poster title={t} size="sm" showRating className="aspect-[2/3] w-full" />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {result && result.channels.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-xs text-faint">ช่องทีวี</h2>
          <div className="grid grid-cols-4 gap-2.5">
            {result.channels.map((c) => (
              <button key={c.id} type="button" onClick={() => openChannel(c)} aria-label={c.name}>
                <ChannelMark name={c.name} className="aspect-[4/3] w-full text-[11px]" />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {result && result.stations.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-xs text-faint">วิทยุ</h2>
          <StationList list={result.stations} />
        </section>
      ) : null}
    </div>
  );
}
