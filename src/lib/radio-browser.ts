import { Capacitor } from "@capacitor/core";
import { stations, type LiveStation } from "@/lib/catalog";
import { loadValue, saveValue } from "@/lib/storage";
import { useApp } from "@/lib/store";

/**
 * Thai stations from Radio Browser (radio-browser.info) — a free, community-run
 * directory with ~50k stations, CORS-enabled and health-checked by the directory itself.
 * Results are cached so the list is there on the next launch even offline.
 */
const MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://at1.api.radio-browser.info",
];
const CACHE_KEY = "dot-rb-th-v1";
const MAX_AGE = 12 * 60 * 60 * 1000;

type RbStation = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  tags: string;
  state: string;
  codec: string;
  votes: number;
  clickcount: number;
  lastcheckok: number;
  hls: number;
};

const native = Capacitor.isNativePlatform();

function clean(name: string) {
  return name.replace(/\s+/g, " ").replace(/[|_]+/g, " ").trim();
}

function key(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");
}

const TAG_TH: Record<string, string> = {
  news: "ข่าว",
  talk: "สนทนา",
  pop: "ป๊อป",
  "thai pop": "ป๊อปไทย",
  country: "ลูกทุ่ง",
  luktung: "ลูกทุ่ง",
  looktung: "ลูกทุ่ง",
  rock: "ร็อก",
  dance: "แดนซ์",
  jazz: "แจ๊ส",
  classic: "คลาสสิก",
  sport: "กีฬา",
  sports: "กีฬา",
  religion: "ธรรมะ",
  buddhism: "ธรรมะ",
  community: "ชุมชน",
  "for life": "เพื่อชีวิต",
  oldies: "เพลงเก่า",
  hits: "เพลงฮิต",
};

function blurbFor(s: RbStation) {
  const tags = s.tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const th = [...new Set(tags.map((t) => TAG_TH[t]).filter(Boolean))];
  if (th.length) return th.slice(0, 2).join(" · ");
  return tags[0] ? tags.slice(0, 2).join(" · ") : "สถานีออนไลน์";
}

function toStation(s: RbStation): LiveStation {
  return {
    id: `rb-${s.stationuuid}`,
    kind: "live",
    name: clean(s.name),
    city: s.state ? s.state.replace(/ Province$/i, "") : "ไทย",
    blurb: blurbFor(s),
    genre: "thai",
    urls: [s.url_resolved],
    fallback: "loft",
    source: "radio-browser",
  };
}

async function fetchMirror(base: string): Promise<RbStation[]> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${base}/json/stations/search?countrycode=TH&hidebroken=true&order=clickcount&reverse=true&limit=300`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as RbStation[];
  } finally {
    window.clearTimeout(timer);
  }
}

function merge(list: LiveStation[]) {
  const seen = new Set(stations.map((s) => key(s.name)));
  const urls = new Set(stations.flatMap((s) => (s.kind === "live" ? s.urls : [])));
  let added = 0;
  for (const st of list) {
    const k = key(st.name);
    const url = st.urls[0] ?? "";
    if (!k || seen.has(k) || urls.has(url)) continue;
    // The web build is served over HTTPS, where browsers block plain-HTTP audio.
    if (!native && url.startsWith("http:")) continue;
    seen.add(k);
    urls.add(url);
    stations.push(st);
    added += 1;
  }
  if (added) useApp.getState().bumpCatalog();
}

export async function loadThaiStations() {
  let cached: { at: number; list: LiveStation[] } | null = null;
  try {
    const raw = await loadValue(CACHE_KEY);
    cached = raw ? JSON.parse(raw) : null;
  } catch {
    cached = null;
  }
  if (cached?.list?.length) merge(cached.list);
  if (cached && Date.now() - cached.at < MAX_AGE) return;

  for (const base of [...MIRRORS].sort(() => Math.random() - 0.5)) {
    try {
      const raw = await fetchMirror(base);
      const list = raw
        .filter((s) => s.lastcheckok === 1 && s.url_resolved && s.name)
        .filter((s) => !/test|backup/i.test(s.name))
        .map(toStation);
      if (!list.length) continue;
      merge(list);
      void saveValue(CACHE_KEY, JSON.stringify({ at: Date.now(), list }));
      return;
    } catch {
      /* try the next mirror */
    }
  }
}
