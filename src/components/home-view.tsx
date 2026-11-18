import { channels, stations, titles, type StudioStation } from "@/lib/catalog";
import { openChannel, openTitle } from "@/lib/actions";
import { playStation } from "@/lib/player";
import { useApp, type TabId } from "@/lib/store";
import { FilmIcon, HeadphonesIcon, MusicIcon, PlayIcon, RadioIcon, SmileIcon, TvIcon } from "@/components/icons";
import { RadioHero } from "@/components/radio-hero";
import { FavoriteRow } from "@/components/radio-view";
import { StoriesRow } from "@/components/stories-row";
import { Poster, SectionHeader } from "@/components/ui";
import { ChannelArt } from "@/components/art";

const CATEGORIES: Array<{ label: string; icon: typeof RadioIcon; tab: TabId; anchor?: string }> = [
  { label: "วิทยุ", icon: RadioIcon, tab: "radio" },
  { label: "ทีวี", icon: TvIcon, tab: "tv" },
  { label: "หนัง", icon: FilmIcon, tab: "movies" },
  { label: "เรื่องเล่า", icon: HeadphonesIcon, tab: "stories" },
  { label: "บันเทิง", icon: SmileIcon, tab: "movies" },
];

export const PLAYLIST_ART: Record<string, [string, string]> = {
  "studio-drive": ["#3b2a5e", "#120c1f"],
  "studio-loft": ["#6a3d1e", "#1a0e06"],
  "studio-focus": ["#1f4553", "#071317"],
  "studio-club": ["#5a1f45", "#170711"],
  "studio-after": ["#4d3a1a", "#140f06"],
  "studio-rain": ["#25384f", "#080c12"],
};

export function HomeView() {
  const featured = titles.find((t) => t.tags.includes("featured")) ?? titles[0];
  const hits = titles.filter((t) => t.tags.includes("popular"));
  const playlists = stations.filter((s): s is StudioStation => s.kind === "studio");
  const popularChannels = channels.filter((c) => c.popular);
  const setTab = useApp((s) => s.setTab);
  const favorites = useApp((s) => s.favorites);
  useApp((s) => s.catalogVersion);
  const favStations = favorites.map((id) => stations.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => Boolean(s));

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-6">
      {featured ? (
        <button type="button" onClick={() => openTitle(featured.id)} className="rise relative block w-full text-left">
          <Poster title={featured} size="lg" className="aspect-[16/10] w-full" />
          <div className="absolute inset-x-4 bottom-4 flex items-end justify-between">
            <span />
            <span className="flex items-center gap-1.5 rounded-full bg-gold-grad px-5 py-2 text-sm font-semibold text-accent-fg">
              <PlayIcon size={14} /> ดูเลย
            </span>
          </div>
        </button>
      ) : null}

      <nav className="mt-5 grid grid-cols-5 gap-1" aria-label="หมวดหมู่">
        {CATEGORIES.map(({ label, icon: Icon, tab, anchor }) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
              else setTab(tab);
            }}
            className="flex flex-col items-center gap-1.5 py-1 text-gold"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-subtle ring-gold">
              <Icon size={24} />
            </span>
            <span className="text-[11px] text-muted">{label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-6">
        <RadioHero compact />
      </div>
      {favStations.length > 0 ? <FavoriteRow list={favStations} /> : null}
      <StoriesRow />

      <section className="mt-7">
        <SectionHeader title="กำลังฮิต" onAction={() => setTab("movies")} />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
          {hits.map((t) => (
            <button key={t.id} type="button" onClick={() => openTitle(t.id)} className="w-40 shrink-0 text-left">
              <Poster title={t} className="aspect-[4/3] w-full" />
            </button>
          ))}
        </div>
      </section>

      <section id="playlists" className="mt-7 scroll-mt-4">
        <SectionHeader title="ฟังเพลย์ลิสต์แนะนำ" onAction={() => setTab("radio")} />
        <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
          {playlists.map((s) => {
            const [a, b] = PLAYLIST_ART[s.id] ?? ["#3a3020", "#0e0b06"];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => void playStation(s)}
                className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl p-2.5 text-left ring-gold"
                style={{ background: `linear-gradient(160deg, ${a}, ${b})` }}
              >
                <p className="text-sm font-semibold leading-tight text-fg">{s.name}</p>
                <p className="mt-1 line-clamp-2 text-[10px] text-muted">{s.blurb}</p>
                <MusicIcon size={34} className="absolute -bottom-1 -right-1 text-gold/30" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title="ทีวีสด" onAction={() => setTab("tv")} />
        <div className="grid grid-cols-4 gap-2.5">
          {popularChannels.map((c) => (
            <button key={c.id} type="button" onClick={() => openChannel(c)} aria-label={c.name}>
              <ChannelArt channel={c} className="aspect-[4/3] w-full" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
