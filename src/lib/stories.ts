import { create } from "zustand";
import { Capacitor } from "@capacitor/core";
import { fetchPublishedText } from "@/lib/remote";
import { loadValue, saveValue } from "@/lib/storage";

/**
 * "เรื่องเล่า" mode: Thai podcasts (horror, stories, knowledge, audio novels, audio drama…)
 * from public/podcasts.json, rebuilt daily by scripts/fetch-podcasts.mjs in CI.
 */
export type Episode = {
  id: string;
  title: string;
  url: string;
  date: number;
  duration: number;
  desc: string;
  image?: string;
};

export type Show = {
  id: string;
  category: string;
  name: string;
  author: string;
  desc: string;
  image: string;
  link: string;
  episodes: Episode[];
};

export type StoryCategory = { id: string; label: string };

type Progress = Record<string, { t: number; d: number; at: number }>;

type StoriesState = {
  status: "idle" | "loading" | "ready" | "error";
  categories: StoryCategory[];
  shows: Show[];
  progress: Progress;
};

export const useStories = create<StoriesState>(() => ({ status: "idle", categories: [], shows: [], progress: {} }));

const CACHE_KEY = "dot-stories-v1";
const PROGRESS_KEY = "dot-ep-progress-v1";
const native = Capacitor.isNativePlatform();

const episodeIndex = new Map<string, { show: Show; episode: Episode }>();

function index(shows: Show[]) {
  episodeIndex.clear();
  for (const show of shows) for (const episode of show.episodes) episodeIndex.set(`${show.id}:${episode.id}`, { show, episode });
}

/** Episode keys are "<showId>:<episodeId>" — episode ids are only unique within a show. */
export const episodeKey = (show: Show, episode: Episode) => `${show.id}:${episode.id}`;
export const getEpisode = (key: string) => episodeIndex.get(key);
export const getShow = (id: string) => useStories.getState().shows.find((s) => s.id === id);

function apply(data: { categories?: StoryCategory[]; shows?: Show[] }) {
  const shows = (data.shows ?? []).map((s) => ({
    ...s,
    // HTTPS pages can't play plain-HTTP audio; native apps can.
    episodes: native ? s.episodes : s.episodes.filter((e) => e.url.startsWith("https:")),
  })).filter((s) => s.episodes.length > 0);
  index(shows);
  useStories.setState({ categories: data.categories ?? [], shows, status: "ready" });
}

export async function loadStories() {
  if (useStories.getState().status === "loading") return;
  void loadValue(PROGRESS_KEY).then((raw) => {
    if (raw) useStories.setState({ progress: JSON.parse(raw) as Progress });
  });
  const cached = await loadValue(CACHE_KEY);
  if (cached) {
    try {
      apply(JSON.parse(cached));
    } catch {
      /* ignore broken cache */
    }
  }
  if (useStories.getState().status !== "ready") useStories.setState({ status: "loading" });
  try {
    const text = await fetchPublishedText("podcasts.json", 10000);
    if (!text) throw new Error("unavailable");
    const data = JSON.parse(text) as { shows?: Show[] };
    if (!data.shows?.length) throw new Error("empty");
    apply(data);
    void saveValue(CACHE_KEY, text);
  } catch {
    if (useStories.getState().status !== "ready") useStories.setState({ status: "error" });
  }
}

let saveTimer = 0;
export function saveProgress(key: string, t: number, d: number) {
  const progress = { ...useStories.getState().progress, [key]: { t: Math.floor(t), d: Math.floor(d), at: Date.now() } };
  // Keep the 200 most recent.
  const entries = Object.entries(progress).sort((a, b) => b[1].at - a[1].at).slice(0, 200);
  useStories.setState({ progress: Object.fromEntries(entries) });
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void saveValue(PROGRESS_KEY, JSON.stringify(Object.fromEntries(entries))), 800);
}

/** Episodes started but not finished, most recent first. */
export function continueListening(progress: Progress) {
  return Object.entries(progress)
    .filter(([, p]) => p.t > 20 && (!p.d || p.t < p.d - 30))
    .sort((a, b) => b[1].at - a[1].at)
    .map(([key, p]) => ({ key, p, item: getEpisode(key) }))
    .filter((x): x is { key: string; p: Progress[string]; item: { show: Show; episode: Episode } } => Boolean(x.item))
    .slice(0, 10);
}

export function formatDuration(sec: number) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

export function formatClock(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
