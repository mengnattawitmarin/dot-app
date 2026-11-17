import { useState } from "react";
import { titles, type Title } from "@/lib/catalog";
import { openTitle } from "@/lib/actions";
import { useApp } from "@/lib/store";
import { ChevronLeft, PlayIcon, StarIcon } from "@/components/icons";
import { Chip, Poster, SectionHeader } from "@/components/ui";

type Filter = "featured" | "new" | "popular";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "featured", label: "แนะนำ" },
  { id: "new", label: "มาใหม่" },
  { id: "popular", label: "ยอดนิยม" },
];

export function MoviesView() {
  const [filter, setFilter] = useState<Filter>("featured");
  const list: Title[] =
    titles.filter((t) => t.tags.includes(filter as Title["tags"][number]));
  const hero = list[0] ?? titles[0];
  const today = [...titles].sort((a, b) => b.rating - a.rating);

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
        <h1 className="text-xl font-semibold">ความบันเทิง</h1>
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
        <Chip onClick={() => useApp.getState().setTab("clipper")}>คลิปสั้น ▸</Chip>
      </div>

      {(
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {hero ? (
            <button type="button" onClick={() => openTitle(hero.id)} className="rise relative block w-full text-left">
              <Poster title={hero} size="lg" className="aspect-[4/5] w-full rounded-2xl">
                <p className="mt-2 text-xs text-muted">
                  {hero.year} · {hero.minutes} นาที ·{" "}
                  <span className="inline-flex items-center gap-0.5 text-gold-light">
                    <StarIcon size={11} /> {hero.rating.toFixed(1)}
                  </span>
                </p>
                <p className="mt-1 text-sm text-fg">{hero.tagline}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold-grad px-5 py-2 text-sm font-semibold text-accent-fg">
                  <PlayIcon size={14} /> ดูเลย
                </span>
              </Poster>
            </button>
          ) : null}

          {list.length > 1 ? (
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {list.slice(1).map((t) => (
                <button key={t.id} type="button" onClick={() => openTitle(t.id)} className="text-left">
                  <Poster title={t} size="sm" showRating className="aspect-[2/3] w-full" />
                </button>
              ))}
            </div>
          ) : null}

          <section className="mt-7">
            <SectionHeader title="น่าสนใจวันนี้" />
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {today.map((t) => (
                <button key={t.id} type="button" onClick={() => openTitle(t.id)} className="w-32 shrink-0 text-left">
                  <Poster title={t} size="sm" showRating className="aspect-[2/3] w-full" />
                  <p className="mt-1.5 truncate text-xs text-muted">{t.tagline}</p>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
