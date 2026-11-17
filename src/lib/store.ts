import { create } from "zustand";
import { loadValue, saveValue } from "@/lib/storage";

export type TabId = "home" | "radio" | "clipper" | "tv" | "movies" | "search" | "profile";
export type Output = "radio" | "tv" | "video" | "idle";

export type NowPlaying = { kind: "station"; id: string } | null;

type Prefs = {
  favorites: string[];
  liked: string[];
  recent: string[];
  volume: number;
  forcedOffline: boolean;
};

const KEY = "dot-prefs-v1";

export type AppState = {
  tab: TabId;
  setTab: (tab: TabId) => void;
  now: NowPlaying;
  setNow: (now: NowPlaying) => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  output: Output;
  setOutput: (output: Output) => void;
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  toggleMute: () => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  liked: string[];
  toggleLike: (id: string) => void;
  recent: string[];
  pushRecent: (id: string) => void;
  forcedOffline: boolean;
  setForcedOffline: (forcedOffline: boolean) => void;
  online: boolean;
  setOnline: (online: boolean) => void;
  nowOpen: boolean;
  setNowOpen: (nowOpen: boolean) => void;
  activeChannel: string | null;
  setActiveChannel: (activeChannel: string | null) => void;
  /** film currently open in the full-screen player */
  activeTitle: string | null;
  setActiveTitle: (activeTitle: string | null) => void;
  toastMsg: string | null;
  toast: (message: string) => void;
  sleepEndsAt: number | null;
  setSleepMinutes: (minutes: number | null) => void;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** replace favourites wholesale (sync code import) */
  importFavorites: (ids: string[]) => void;
  /** bumped when the remote catalogue changes the station/channel lists */
  catalogVersion: number;
  bumpCatalog: () => void;
};

let toastTimer = 0;

async function readPrefs(): Promise<Partial<Prefs>> {
  const raw = await loadValue(KEY);
  if (!raw) return {};
  try {
    return (JSON.parse(raw) as Partial<Prefs>) ?? {};
  } catch {
    return {};
  }
}

function writePrefs(state: AppState) {
  const prefs: Prefs = {
    favorites: state.favorites,
    liked: state.liked,
    recent: state.recent,
    volume: state.volume,
    forcedOffline: state.forcedOffline,
  };
  void saveValue(KEY, JSON.stringify(prefs));
}

export const useApp = create<AppState>((set, get) => ({
  tab: "home",
  setTab: (tab) => set({ tab, nowOpen: false }),
  now: null,
  setNow: (now) => set({ now }),
  playing: false,
  setPlaying: (playing) => set({ playing }),
  output: "idle",
  setOutput: (output) => set({ output }),
  volume: 0.85,
  setVolume: (volume) => {
    set({ volume, muted: volume === 0 });
    writePrefs(get());
  },
  muted: false,
  toggleMute: () => set({ muted: !get().muted }),
  favorites: [],
  toggleFavorite: (id) => {
    const favorites = get().favorites.includes(id)
      ? get().favorites.filter((item) => item !== id)
      : [id, ...get().favorites];
    set({ favorites });
    writePrefs(get());
  },
  liked: [],
  toggleLike: (id) => {
    const liked = get().liked.includes(id)
      ? get().liked.filter((item) => item !== id)
      : [id, ...get().liked];
    set({ liked });
    writePrefs(get());
  },
  recent: [],
  pushRecent: (id) => {
    const recent = [id, ...get().recent.filter((item) => item !== id)].slice(0, 8);
    set({ recent });
    writePrefs(get());
  },
  forcedOffline: false,
  setForcedOffline: (forcedOffline) => {
    set({ forcedOffline });
    writePrefs(get());
  },
  online: true,
  setOnline: (online) => set({ online }),
  nowOpen: false,
  setNowOpen: (nowOpen) => set({ nowOpen }),
  activeChannel: null,
  setActiveChannel: (activeChannel) => set({ activeChannel }),
  activeTitle: null,
  setActiveTitle: (activeTitle) => set({ activeTitle }),
  toastMsg: null,
  toast: (message) => {
    window.clearTimeout(toastTimer);
    set({ toastMsg: message });
    toastTimer = window.setTimeout(() => set({ toastMsg: null }), 2800);
  },
  sleepEndsAt: null,
  setSleepMinutes: (minutes) => {
    set({ sleepEndsAt: minutes == null ? null : Date.now() + minutes * 60_000 });
  },
  catalogVersion: 0,
  bumpCatalog: () => set({ catalogVersion: get().catalogVersion + 1 }),
  importFavorites: (ids) => {
    const favorites = [...new Set([...ids, ...get().favorites])];
    set({ favorites });
    writePrefs(get());
  },
  hydrated: false,
  hydrate: async () => {
    const prefs = await readPrefs();
    set({
      hydrated: true,
      favorites: prefs.favorites ?? [],
      liked: prefs.liked ?? [],
      recent: prefs.recent ?? [],
      volume: typeof prefs.volume === "number" ? prefs.volume : 0.85,
      forcedOffline: Boolean(prefs.forcedOffline),
    });
  },
}));

export function selectOffline(state: Pick<AppState, "online" | "forcedOffline">) {
  return !state.online || state.forcedOffline;
}
