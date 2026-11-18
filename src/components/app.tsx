import { useEffect } from "react";
import { channels, getChannel, getStation, getTitle } from "@/lib/catalog";
import { StationArt } from "@/components/art";
import { closeChannel, closeTitle, openChannel } from "@/lib/actions";
import { applyVolume, bindAudio, pauseRadio, playStation, toggleRadio } from "@/lib/player";
import { selectOffline, useApp, type TabId } from "@/lib/store";
import { cn } from "@/lib/cn";
import { loadRemote } from "@/lib/remote";
import { loadThaiStations } from "@/lib/radio-browser";
import { initAuth } from "@/lib/supabase";
import { pullFavorites, watchFavorites } from "@/lib/cloud";
import { resumePush } from "@/lib/push";
import { splitSong } from "@/lib/now-playing";
import { SignInSheet } from "@/components/account";
import { NoticesSheet, useUnreadCount } from "@/components/notices-sheet";
import { BellIcon, ClipIcon, HomeIcon, PauseIcon, PlayIcon, RadioIcon, SearchIcon, TvIcon, UserIcon } from "@/components/icons";
import { ClipperView } from "@/components/clipper-view";
import { StoriesView } from "@/components/stories-view";
import { DharmaView, EpisodeCover } from "@/components/dharma-view";
import { openDharmaLater } from "@/lib/dharma";
import { getEpisode } from "@/lib/stories";
import { useEpisodeUi } from "@/lib/episode-player";
import { HomeView } from "@/components/home-view";
import { MoviesView } from "@/components/movies-view";
import { NowScreen } from "@/components/now-screen";
import { ProfileView } from "@/components/profile-view";
import { RadioView } from "@/components/radio-view";
import { SearchView } from "@/components/search-view";
import { TvView } from "@/components/tv-view";
import { Logo, Waveform } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";

const NAV: Array<{ id: TabId; label: string; icon: typeof HomeIcon }> = [
  { id: "home", label: "หน้าหลัก", icon: HomeIcon },
  { id: "radio", label: "วิทยุ", icon: RadioIcon },
  { id: "clipper", label: "คลิป", icon: ClipIcon },
  { id: "tv", label: "ทีวี", icon: TvIcon },
  { id: "profile", label: "โปรไฟล์", icon: UserIcon },
];

export function App() {
  const tab = useApp((s) => s.tab);
  useApp((s) => s.catalogVersion); // re-render screens when the remote catalogue lands
  const now = useApp((s) => s.now);
  const playing = useApp((s) => s.playing && s.output === "radio");
  const toastMsg = useApp((s) => s.toastMsg);
  const sleepEndsAt = useApp((s) => s.sleepEndsAt);
  const online = useApp((s) => s.online);
  const forced = useApp((s) => s.forcedOffline);
  const hydrated = useApp((s) => s.hydrated);
  const offline = useApp(selectOffline);
  const activeTitle = useApp((s) => s.activeTitle);
  const activeChannel = useApp((s) => s.activeChannel);
  const station = now?.kind === "station" ? getStation(now.id) : undefined;
  const episode = now?.kind === "episode" ? getEpisode(now.id) : undefined;
  const unread = useUnreadCount();
  const song = splitSong(useApp((s) => s.songTitle));
  const title = activeTitle ? getTitle(activeTitle) : undefined;
  const channel = activeChannel ? getChannel(activeChannel) : undefined;

  useEffect(() => {
    void useApp.getState().hydrate().then(() => {
      applyVolume();
      // Link into the ธรรมะ mode: ?tab=dharma[&teacher=<id>][&album=<albumId>]
      const q = new URLSearchParams(window.location.search);
      if (q.get("tab") !== "dharma" && !q.has("dharma")) return;
      const teacher = q.get("teacher") ?? q.get("dharma");
      const album = q.get("album");
      if (album) openDharmaLater({ kind: "album", showId: album.startsWith("dh-") ? album : `dh-${album}` });
      else if (teacher) openDharmaLater({ kind: "teacher", id: teacher });
      useApp.getState().setTab("dharma");
      window.history.replaceState(null, "", window.location.pathname);
    });
    void loadRemote()
      .then(loadThaiStations)
      .then(() => {
        // Shared link: ?station=<id> opens that station ready to play (autoplay needs a tap).
        const id = new URLSearchParams(window.location.search).get("station");
        if (!id || !getStation(id)) return;
        const s = useApp.getState();
        s.setTab("radio");
        s.setNow({ kind: "station", id });
        s.setNowOpen(true);
        window.history.replaceState(null, "", window.location.pathname);
      });
    watchFavorites();
    void initAuth(() => {
      void pullFavorites();
      void resumePush();
      useApp.getState().bumpNotices();
    });
    const sync = () => useApp.getState().setOnline(navigator.onLine);
    const wentOffline = () => {
      useApp.getState().setOnline(false);
      const s = useApp.getState();
      if (!s.playing || s.output !== "radio" || !s.now) return;
      const current = getStation(s.now.id);
      if (current?.kind === "live") void playStation(current); // falls back to an offline studio
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", wentOffline);
    sync();
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      void toggleRadio();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", wentOffline);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (!sleepEndsAt) return;
    const timer = window.setTimeout(
      () => {
        pauseRadio();
        const s = useApp.getState();
        s.setOutput("idle");
        s.setPlaying(false);
        s.setSleepMinutes(null);
        s.toast("หมดเวลาที่ตั้งไว้ ปิดเสียงแล้ว");
      },
      Math.max(0, sleepEndsAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [sleepEndsAt]);

  const banner = !hydrated ? null : !online ? "ไม่มีอินเทอร์เน็ต — สตูดิโอในเครื่องยังเล่นได้" : forced ? "โหมดในเครื่อง — ช่องสดถูกพักไว้" : null;
  const navTab: TabId = tab === "movies" || tab === "dharma" || tab === "stories" ? "home" : tab;

  return (
    <div className="relative mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-bg text-fg">
      <audio
        ref={(node) => {
          if (node) bindAudio(node);
        }}
        className="hidden"
      />

      {tab !== "movies" && tab !== "clipper" && tab !== "stories" && tab !== "dharma" ? (
        <header className="safe-top flex items-center justify-between px-4 pb-2">
          <button type="button" onClick={() => useApp.getState().setTab("home")} aria-label="หน้าหลัก">
            <Logo className="text-[26px]" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="การแจ้งเตือน"
              onClick={() => useApp.getState().setNoticesOpen(true)}
              className="relative grid size-10 place-items-center text-fg"
            >
              <BellIcon size={22} />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-live px-1 text-[9px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </button>
            <button type="button" aria-label="ค้นหา" onClick={() => useApp.getState().setTab("search")} className="grid size-10 place-items-center text-fg">
              <SearchIcon size={22} />
            </button>
          </div>
        </header>
      ) : tab === "movies" || tab === "stories" || tab === "dharma" ? (
        <div className="safe-top" />
      ) : null}
      {banner ? <p className="mx-4 mb-2 rounded-lg bg-subtle px-3 py-1.5 text-center text-xs text-muted">{banner}</p> : null}

      <main className="min-h-0 flex-1">
        {tab === "home" ? <HomeView /> : null}
        {tab === "radio" ? <RadioView /> : null}
        {tab === "tv" ? <TvView /> : null}
        {tab === "movies" ? <MoviesView /> : null}
        {tab === "search" ? <SearchView /> : null}
        {tab === "clipper" ? <ClipperView /> : null}
        {tab === "stories" ? <StoriesView /> : null}
        {tab === "dharma" ? <DharmaView /> : null}
        {tab === "profile" ? <ProfileView /> : null}
      </main>

      {episode && tab !== "clipper" ? <EpisodeMini item={episode} playing={playing} /> : null}

      {station && tab !== "clipper" ? (
        <div className="mx-3 mb-2 flex h-14 items-center gap-3 rounded-2xl bg-elevated pl-2 pr-1.5 ring-gold">
          <button type="button" onClick={() => useApp.getState().setNowOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <StationArt station={station} size="md" className="size-10 rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{song ? song.title : station.name}</span>
              <span className="block truncate text-xs text-muted">
                {song ? [song.artist, station.name].filter(Boolean).join(" · ") : `${playing ? "กำลังเล่น" : "หยุดชั่วคราว"} · ${station.city}`}
              </span>
            </span>
            <Waveform active={playing} live={station.kind === "live"} bars={10} height={20} className="w-12" />
          </button>
          <button
            type="button"
            aria-label={playing ? "หยุดชั่วคราว" : "เล่น"}
            onClick={() => void toggleRadio()}
            className="grid size-10 place-items-center rounded-full bg-gold-grad text-accent-fg"
          >
            {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} className="translate-x-px" />}
          </button>
        </div>
      ) : null}

      <nav className={cn("safe-bottom grid grid-cols-5 border-t", tab === "clipper" ? "border-white/10 bg-black" : "border-line bg-bg/95 backdrop-blur")} aria-label="เมนูหลัก">
        {NAV.map(({ id, label, icon: Icon }) => {
          const selected = navTab === id;
          return (
            <button
              key={id}
              type="button"
              aria-current={selected ? "page" : undefined}
              onClick={() => useApp.getState().setTab(id)}
              className={cn("relative flex h-[58px] flex-col items-center justify-center gap-1 text-[11px]", selected ? "text-gold" : "text-faint")}
            >
              <Icon size={22} strokeWidth={selected ? 2 : 1.6} />
              {label}
              {selected ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gold" /> : null}
            </button>
          );
        })}
      </nav>

      <NowScreen />
      <NoticesSheet />
      <SignInSheet />

      {title ? (
        <VideoPlayer
          name={title.name}
          subtitle={`${title.year} · ${title.tagline}`}
          src={title.src}
          blocked={offline}
          onClose={closeTitle}
        />
      ) : null}

      {channel ? (
        <VideoPlayer
          name={channel.name}
          subtitle={channel.blurb}
          src={channel.mode === "video" ? channel.src : undefined}
          hls={channel.hls}
          scene={channel.scene}
          live={channel.mode === "video"}
          blocked={channel.mode === "video" && offline}
          onClose={closeChannel}
          rail={
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 py-3">
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openChannel(c)}
                  className={cn(
                    "h-9 shrink-0 rounded-full px-4 text-[13px]",
                    c.id === channel.id ? "bg-gold-grad text-accent-fg" : "bg-subtle text-muted ring-gold",
                    c.mode === "video" && offline && "opacity-40",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          }
        />
      ) : null}

      {toastMsg ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-32 z-50 flex justify-center px-4">
          <p className="rise rounded-full bg-gold-grad px-4 py-2 text-sm font-medium text-accent-fg shadow-lg">{toastMsg}</p>
        </div>
      ) : null}
    </div>
  );
}

function EpisodeMini({ item, playing }: { item: NonNullable<ReturnType<typeof getEpisode>>; playing: boolean }) {
  const { position, duration } = useEpisodeUi();
  const total = duration || item.episode.duration;
  return (
    <div className="relative mx-3 mb-2 overflow-hidden rounded-2xl bg-elevated ring-gold">
      <div className="flex h-14 items-center gap-3 pl-2 pr-1.5">
        <button type="button" onClick={() => useApp.getState().setNowOpen(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <EpisodeCover show={item.show} image={item.episode.image} className="size-10 rounded-lg" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{item.episode.title}</span>
            <span className="block truncate text-xs text-muted">{item.show.name}</span>
          </span>
        </button>
        <button
          type="button"
          aria-label={playing ? "หยุดชั่วคราว" : "เล่น"}
          onClick={() => void toggleRadio()}
          className="grid size-10 place-items-center rounded-full bg-gold-grad text-accent-fg"
        >
          {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} className="translate-x-px" />}
        </button>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
        <span className="block h-full bg-gold" style={{ width: `${total ? Math.min(100, (position / total) * 100) : 0}%` }} />
      </span>
    </div>
  );
}
