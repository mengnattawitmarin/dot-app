#!/usr/bin/env node
/**
 * Builds public/films.json — free, legally streamable films for the "หนัง" screen.
 *
 * Source: Internet Archive moving-image collections that hold public-domain / openly licensed
 * films (Feature Films, Classic Cartoons, Silent Films, Film Noir, Sci-Fi & Horror, Comedy…).
 * Only items with a plain MP4 file are kept, so the in-app player streams them directly.
 * Posters are generated in the app (no key art), from the palette chosen here.
 *
 * Run: node scripts/fetch-films.mjs [--dry]
 */
import fs from "node:fs";
import crypto from "node:crypto";

const UA = "Mozilla/5.0 (compatible; DoT-app/1.0; +https://github.com/mengnattawitmarin/dot-app)";
const DRY = process.argv.includes("--dry");

/** Genres shown as rows. `q` = archive.org query (all public-domain/open collections). */
export const GENRES = [
  { id: "classic", label: "หนังคลาสสิก", q: "collection:(feature_films)", max: 40, kind: "movie" },
  { id: "noir", label: "ฟิล์มนัวร์ · สืบสวน", q: "collection:(Film_Noir)", max: 24, kind: "movie" },
  { id: "horror", label: "สยองขวัญ · ไซไฟ", q: "collection:(SciFi_Horror)", max: 30, kind: "movie" },
  { id: "comedy", label: "ตลกคลาสสิก", q: "collection:(Comedy_Films)", max: 20, kind: "movie" },
  { id: "silent", label: "หนังเงียบ", q: "collection:(silent_films)", max: 24, kind: "movie" },
  { id: "cartoon", label: "การ์ตูนคลาสสิก", q: "collection:(classic_cartoons)", max: 40, kind: "short" },
  { id: "western", label: "คาวบอย", q: "collection:(feature_films) AND subject:(western)", max: 16, kind: "movie" },
  { id: "open", label: "แอนิเมชันเปิด (Blender)", q: "collection:(blender-foundation) OR (creator:(\"Blender Foundation\") AND mediatype:movies)", max: 12, kind: "short" },
];

const SCENES = ["rain", "drive", "ocean", "blocks", "horizon", "grain"];
const PALETTES = [
  ["#6b3a1c", "#120805"],
  ["#2f4a3c", "#07110c"],
  ["#3d5a1e", "#0d1405"],
  ["#4a2a4f", "#0f0712"],
  ["#22405e", "#060d16"],
  ["#5e2626", "#140606"],
  ["#5a4a1e", "#141005"],
  ["#2a3350", "#080a14"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hash = (s) => crypto.createHash("sha1").update(s).digest("hex");

async function get(url, { tries = 3, timeout = 25000 } = {}) {
  for (let i = 1; ; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(1500 * i);
    } finally {
      clearTimeout(t);
    }
  }
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        try {
          out[k] = await fn(items[k]);
        } catch (e) {
          out[k] = null;
          console.warn(`  ! ${items[k]?.identifier}: ${e.message}`);
        }
      }
    }),
  );
  return out;
}

const first = (v) => (Array.isArray(v) ? v[0] : v) ?? "";
const clean = (s, max = 200) => {
  const t = String(s ?? "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export function toSeconds(v) {
  const s = String(v ?? "").trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  return Math.round(s.split(":").map(Number).reduce((a, n) => a * 60 + (n || 0), 0));
}

/** Best directly playable MP4 in an item: H.264 > MPEG4 derivative > any .mp4. */
export function pickVideo(files) {
  const mp4 = (files ?? []).filter((f) => /\.mp4$/i.test(f.name) && !/sample|trailer|preview/i.test(f.name));
  if (!mp4.length) return null;
  const score = (f) =>
    (/h\.264/i.test(f.format ?? "") ? 30 : 0) +
    (/512kb|mpeg4/i.test(f.format ?? "") ? 20 : 0) +
    (f.source === "original" ? 5 : 0) +
    Math.min(10, toSeconds(f.length) / 600) -
    (Number(f.size ?? 0) > 2.5e9 ? 40 : 0); // multi-GB originals stall on phones
  return [...mp4].sort((a, b) => score(b) - score(a))[0];
}

/** Short Thai line under the title — the archive's own descriptions are English. */
function tagline(genre, year, minutes, lang) {
  const bits = [genre.label.split(" · ")[0]];
  if (year) bits.push(`ปี ${year}`);
  if (minutes) bits.push(`${minutes} นาที`);
  bits.push(lang);
  return bits.join(" · ");
}

async function search(q, rows) {
  const fl = ["identifier", "title", "year", "date", "downloads", "language", "licenseurl"].map((f) => `fl[]=${f}`).join("&");
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(`(${q}) AND mediatype:(movies)`)}&${fl}&rows=${rows}&page=1&output=json&sort[]=downloads+desc`;
  try {
    return (await get(url)).response?.docs ?? [];
  } catch (e) {
    console.warn(`search failed (${q}): ${e.message}`);
    return [];
  }
}

async function main() {
  const seen = new Set();
  const titles = [];
  const genres = [];
  for (const genre of GENRES) {
    const docs = (await search(genre.q, genre.max * 3)).filter((d) => !seen.has(d.identifier));
    const metas = await pool(docs.slice(0, genre.max * 2), 6, (d) => get(`https://archive.org/metadata/${encodeURIComponent(d.identifier)}`));
    let kept = 0;
    for (let i = 0; i < metas.length && kept < genre.max; i++) {
      const m = metas[i];
      const doc = docs[i];
      if (!m?.metadata || seen.has(doc.identifier)) continue;
      const video = pickVideo(m.files);
      if (!video) continue;
      const seconds = toSeconds(video.length);
      if (genre.kind === "movie" && seconds && seconds < 20 * 60) continue;
      const md = m.metadata;
      const name = clean(first(md.title), 70);
      if (!name || /trailer|preview|test/i.test(name)) continue;
      // Family app: skip exploitation / adult-themed titles.
      if (/sex|nud(e|ist)|burlesque|strip|reefer|marihuana|marijuana|cocaine|naked|erotic|sin\b|vice|girls? gone|lust|seduc|molest|rape|concentration camp|atrocit|execution|suicide|drug addict|narcotic/i.test(`${name} ${first(md.subject)}`)) continue;
      const year = Number(String(first(md.year) || first(md.date)).slice(0, 4)) || 0;
      const minutes = Math.round(seconds / 60);
      const langRaw = String(first(md.language)).toLowerCase();
      const lang = genre.id === "silent" ? "หนังเงียบ" : /eng|^en$/.test(langRaw) || !langRaw ? "เสียงอังกฤษ" : `เสียง ${langRaw}`;
      const h = hash(doc.identifier);
      seen.add(doc.identifier);
      kept++;
      titles.push({
        id: `ia-${doc.identifier}`.slice(0, 80),
        name,
        tagline: tagline(genre, year, minutes, lang),
        kind: genre.kind,
        year,
        minutes,
        rating: 0,
        src: `https://archive.org/download/${encodeURIComponent(doc.identifier)}/${video.name.split("/").map(encodeURIComponent).join("/")}`,
        palette: PALETTES[parseInt(h.slice(0, 2), 16) % PALETTES.length],
        scene: SCENES[parseInt(h.slice(2, 4), 16) % SCENES.length],
        tags: [],
        genre: genre.id,
        about: clean(first(md.description), 300) || undefined,
        link: `https://archive.org/details/${encodeURIComponent(doc.identifier)}`,
        views: Number(doc.downloads ?? 0),
      });
    }
    console.log(`${genre.label}: ${kept}`);
    if (kept) genres.push({ id: genre.id, label: genre.label });
    await sleep(300);
  }
  // Tags for the filter chips: most watched = ยอดนิยม, newest additions to this file = มาใหม่.
  const byViews = [...titles].sort((a, b) => b.views - a.views);
  byViews.slice(0, 18).forEach((t) => t.tags.push("popular"));
  byViews.filter((t) => t.kind === "movie").slice(0, 6).forEach((t) => t.tags.push("featured"));
  let previous = [];
  try {
    previous = JSON.parse(fs.readFileSync("public/films.json", "utf8")).titles?.map((t) => t.id) ?? [];
  } catch {
    /* first run */
  }
  const old = new Set(previous);
  titles.filter((t) => previous.length && !old.has(t.id)).slice(0, 12).forEach((t) => t.tags.push("new"));
  console.log(`Total: ${titles.length} films`);
  if (DRY) return;
  if (titles.length < 20) {
    console.error("Too few films — keeping the previous films.json");
    return;
  }
  fs.writeFileSync("public/films.json", JSON.stringify({ updatedAt: new Date().toISOString(), genres, titles }));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
