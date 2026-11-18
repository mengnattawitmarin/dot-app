import { useEffect, useMemo } from "react";
import { continueListening, loadStories, useStories } from "@/lib/stories";
import { playEpisode } from "@/lib/episode-player";
import { useApp } from "@/lib/store";
import { CoverImage } from "@/components/stories-view";
import { SectionHeader } from "@/components/ui";

/** Home-screen teaser for the stories mode: continue listening, else a few shows. */
export function StoriesRow() {
  const { shows, progress } = useStories();
  useEffect(() => {
    void loadStories();
  }, []);
  const resume = useMemo(() => continueListening(progress).filter((x) => !x.item.show.id.startsWith("dh-")), [progress, shows]);
  if (shows.length === 0) return null;
  const openShow = (id: string) => {
    useApp.getState().setTab("stories");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("dot:open-show", { detail: id })), 50);
  };
  return (
    <section className="mt-7">
      <SectionHeader title={resume.length ? "ฟังเรื่องเล่าต่อ" : "เรื่องเล่า & นิยายเสียง"} onAction={() => useApp.getState().setTab("stories")} />
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
        {resume.length
          ? resume.map(({ key, p, item }) => (
              <button key={key} type="button" onClick={() => void playEpisode(key)} className="w-32 shrink-0 text-left">
                <span className="relative block">
                  <CoverImage src={item.episode.image || item.show.image} name={item.show.name} className="aspect-square w-full" />
                  <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-black/50">
                    <span className="block h-full bg-gold" style={{ width: `${p.d ? Math.min(100, (p.t / p.d) * 100) : 0}%` }} />
                  </span>
                </span>
                <span className="mt-1.5 line-clamp-2 block text-xs leading-snug">{item.episode.title}</span>
              </button>
            ))
          : shows.slice(0, 12).map((s) => (
              <button key={s.id} type="button" onClick={() => openShow(s.id)} className="w-28 shrink-0 text-left">
                <CoverImage src={s.image} name={s.name} className="aspect-square w-full" />
                <span className="mt-1.5 line-clamp-2 block text-xs leading-snug">{s.name}</span>
              </button>
            ))}
      </div>
    </section>
  );
}
