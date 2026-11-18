import { create } from "zustand";
import { Capacitor } from "@capacitor/core";
import { fetchPublishedText } from "@/lib/remote";
import { loadValue, saveValue } from "@/lib/storage";
import { registerShows, type Show } from "@/lib/stories";

/**
 * "ธรรมะ" mode: free dharma talks grouped teacher → ชุด/วาระ (album) → ตอน (track).
 * Data: public/dharma.json, rebuilt daily in CI by scripts/fetch-dharma.mjs.
 * Albums are registered as stories "shows" so the episode player, resume, lock screen
 * and "ฟังต่อ" work the same way.
 */
type RawTrack = { t: string; u: string; d: number };
type RawAlbum = {
  id: string;
  title: string;
  group?: string;
  topic: string;
  src: "archive" | "podcast" | "web";
  link: string;
  base: string;
  year?: number;
  desc?: string;
  image?: string;
  n: number;
  dur: number;
  tracks: RawTrack[];
};
type RawTeacher = { id: string; name: string; full: string; place: string; blurb: string; albums: RawAlbum[] };
type RawData = { updatedAt?: string; topics?: DharmaTopic[]; teachers?: RawTeacher[] };

export type DharmaTopic = { id: string; label: string };
export type DharmaAlbum = Omit<RawAlbum, "tracks"> & { teacherId: string; showId: string };
export type Teacher = Omit<RawTeacher, "albums"> & { albums: DharmaAlbum[]; tracks: number; hours: number };

type DharmaState = {
  status: "idle" | "loading" | "ready" | "error";
  topics: DharmaTopic[];
  teachers: Teacher[];
};

export const useDharma = create<DharmaState>(() => ({ status: "idle", topics: [], teachers: [] }));

const CACHE_KEY = "dot-dharma-v1";
const native = Capacitor.isNativePlatform();
const albumsByShow = new Map<string, DharmaAlbum>();

export type DharmaTarget = { kind: "album"; showId: string } | { kind: "teacher"; id: string };
let pending: DharmaTarget | null = null;
/** Open an album / teacher when the ธรรมะ screen mounts (e.g. from the player or home row). */
export function openDharmaLater(target: DharmaTarget) {
  pending = target;
  window.dispatchEvent(new CustomEvent("dot:open-dharma", { detail: target }));
}
export const openAlbumLater = (showId: string) => openDharmaLater({ kind: "album", showId });
export function takePending() {
  const t = pending;
  pending = null;
  return t;
}

export const isDharmaShow = (showId: string) => showId.startsWith("dh-");
export const getAlbum = (showId: string) => albumsByShow.get(showId);
export const getTeacher = (id: string) => useDharma.getState().teachers.find((t) => t.id === id);
export const topicLabel = (id: string) => useDharma.getState().topics.find((t) => t.id === id)?.label ?? "ธรรมเทศนา";

function apply(data: RawData) {
  const shows: Show[] = [];
  albumsByShow.clear();
  const teachers: Teacher[] = [];
  for (const t of data.teachers ?? []) {
    const albums: DharmaAlbum[] = [];
    for (const a of t.albums) {
      const showId = `dh-${a.id}`;
      const episodes = a.tracks
        .map((tr, i) => ({
          id: String(i),
          title: tr.t,
          url: a.base ? a.base + tr.u.split("/").map(encodeURIComponent).join("/") : tr.u,
          date: 0,
          duration: tr.d,
          desc: "",
        }))
        // HTTPS pages can't play plain-HTTP audio; native apps can.
        .filter((e) => native || e.url.startsWith("https:"));
      if (!episodes.length) continue;
      const { tracks: _tracks, ...rest } = a;
      const album: DharmaAlbum = { ...rest, n: episodes.length, teacherId: t.id, showId };
      albums.push(album);
      albumsByShow.set(showId, album);
      shows.push({
        id: showId,
        category: `dharma:${t.id}`,
        name: a.group ? `${a.group} · ${a.title}` : a.title,
        author: t.name,
        desc: a.desc ?? "",
        image: a.image ?? "",
        link: a.link,
        episodes,
      });
    }
    if (!albums.length) continue;
    const { albums: _a, ...info } = t;
    teachers.push({
      ...info,
      albums,
      tracks: albums.reduce((s, a) => s + a.n, 0),
      hours: Math.round(albums.reduce((s, a) => s + a.dur, 0) / 3600),
    });
  }
  registerShows("dharma", shows);
  useDharma.setState({ topics: data.topics ?? [], teachers, status: "ready" });
}

export async function loadDharma() {
  const state = useDharma.getState();
  if (state.status === "loading" || state.status === "ready") return;
  const cached = await loadValue(CACHE_KEY);
  if (cached) {
    try {
      apply(JSON.parse(cached) as RawData);
    } catch {
      /* ignore broken cache */
    }
  }
  if (useDharma.getState().status !== "ready") useDharma.setState({ status: "loading" });
  try {
    const text = await fetchPublishedText("dharma.json", 20000);
    if (!text) throw new Error("unavailable");
    const data = JSON.parse(text) as RawData;
    if (!data.teachers?.length) throw new Error("empty");
    apply(data);
    // localStorage holds ~5 MB in total; don't push the web build's prefs out.
    if (native || text.length < 2_000_000) void saveValue(CACHE_KEY, text);
  } catch {
    if (useDharma.getState().status !== "ready") useDharma.setState({ status: "error" });
  }
}

/** Force a reload (retry button). */
export function reloadDharma() {
  useDharma.setState({ status: "idle" });
  return loadDharma();
}

/** Two-letter emblem for a teacher card, from the name without honorifics. */
export function teacherMark(name: string) {
  const bare = name.replace(/^(หลวงพ่อ|หลวงตา|หลวงปู่|พระอาจารย์|พระมหา|ท่านพ่อ|ท่าน|พระ)\s*/u, "").replace(/^ว\.\s*/, "");
  return bare.match(/^[เแโใไ]?[ก-ฮ][\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]*/u)?.[0] ?? "ธ";
}

export function formatHours(sec: number) {
  if (!sec) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h} ชม.${m ? ` ${m} น.` : ""}` : `${m} นาที`;
}
