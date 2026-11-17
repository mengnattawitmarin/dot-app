// Builds public/podcasts.json — the catalogue for the "เรื่องเล่า" (stories) mode.
// Runs in CI (needs internet): finds Thai podcasts per category with the iTunes Search API,
// reads each show's public RSS feed and keeps the latest episodes.
// Audio is streamed straight from each publisher's host; nothing is re-hosted.
//
//   node scripts/fetch-podcasts.mjs            → writes public/podcasts.json
//   node scripts/fetch-podcasts.mjs --feed=FILE → parse a local RSS file (for testing)
import fs from "node:fs";
import crypto from "node:crypto";

// genres = Apple Podcasts genre ids; keywords are matched against show name + description.
export const CATEGORIES = [
  { id: "horror", label: "สยองขวัญ", genres: [], terms: ["เรื่องผี", "เล่าเรื่องผี", "the ghost radio", "สยองขวัญ", "เรื่องหลอน", "ผีไทย", "เรื่องลี้ลับ"], keywords: ["ผี", "หลอน", "สยอง", "ghost", "horror", "ลี้ลับ", "อาถรรพ์", "วิญญาณ"], evergreen: true },
  { id: "mystery", label: "คดี & ลึกลับ", genres: ["1488"], terms: ["คดีดัง", "คดีฆาตกรรม", "true crime", "ฆาตกร", "อาชญากรรม"], keywords: ["คดี", "ฆาตกร", "ฆาตกรรม", "อาชญากรรม", "crime", "ปริศนา", "ลึกลับ"], evergreen: true },
  { id: "story", label: "เรื่องเล่า", genres: ["1302"], terms: ["เล่าเรื่อง", "เรื่องเล่า", "เรื่องจริง", "ประสบการณ์ชีวิต"], keywords: ["เรื่องเล่า", "เล่าเรื่อง", "เรื่องจริง", "ประสบการณ์", "story"] },
  { id: "novel", label: "นิยายเสียง", genres: ["1483", "1482"], terms: ["นิยายเสียง", "หนังสือเสียง", "อ่านนิยาย", "นิทาน", "audiobook", "เรื่องสั้น"], keywords: ["นิยาย", "หนังสือเสียง", "นิทาน", "อ่านให้ฟัง", "เรื่องสั้น", "audiobook", "วรรณกรรม"], evergreen: true },
  { id: "drama", label: "ภาพยนตร์ & ละครเสียง", genres: ["1484", "1485", "1486"], terms: ["ละครเสียง", "ละครวิทยุ", "audio drama", "หนังเสียง", "radio drama", "ละคร", "ละครเสียงตลก", "ซีรีส์เสียง", "audio series"], keywords: ["ละครเสียง", "ละครวิทยุ", "audio drama", "radio drama", "หนังเสียง", "ภาพยนตร์เสียง", "ละคร", "ซีรีส์เสียง", "audio series"], evergreen: true },
  { id: "history", label: "ประวัติศาสตร์", genres: ["1487"], terms: ["ประวัติศาสตร์", "ประวัติศาสตร์ไทย", "ย้อนอดีต", "history thai"], keywords: ["ประวัติศาสตร์", "history", "ย้อนอดีต", "สมัยก่อน", "พงศาวดาร"], evergreen: true },
  { id: "knowledge", label: "ความรู้", genres: ["1533", "1304", "1543"], terms: ["ความรู้", "วิทยาศาสตร์", "รอบรู้", "สารคดี", "ความรู้รอบตัว"], keywords: ["ความรู้", "วิทยาศาสตร์", "science", "สารคดี", "รู้ไว้", "อธิบาย"] },
  { id: "self", label: "พัฒนาตัวเอง", genres: ["1500", "1544"], terms: ["พัฒนาตัวเอง", "จิตวิทยา", "แรงบันดาลใจ", "สรุปหนังสือ"], keywords: ["พัฒนาตัวเอง", "จิตวิทยา", "แรงบันดาลใจ", "mindset", "self"] },
  { id: "business", label: "ธุรกิจ & การเงิน", genres: ["1321", "1412", "1493"], terms: ["ธุรกิจ", "การเงิน", "การลงทุน", "หุ้น"], keywords: ["ธุรกิจ", "การเงิน", "ลงทุน", "หุ้น", "business", "money"] },
  { id: "dharma", label: "ธรรมะ", genres: ["1438", "1314"], terms: ["ธรรมะ", "ฟังธรรม", "พระธรรมเทศนา", "สมาธิ"], keywords: ["ธรรมะ", "ธรรม", "พระ", "สมาธิ", "dharma", "buddh"] },
];

// News / talk radio relays clutter story categories.
const EXCLUDE_GENRES = new Set(["1489", "1526", "1527", "1528", "1529", "1530", "1531", "1545", "1310", "1511"]);
const EXCLUDE_WORDS = /สวท\.|\bFM\b|news|ข่าว|sbs|เรดิโอ|radio thailand|ภาษาไทย.*business/i;

const SHOWS_PER_CATEGORY = 12;
const EPISODES_PER_SHOW = 15;
const UA = "DoT-Podcasts/1.0 (+https://github.com/mengnattawitmarin/dot-app)";

const hash = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : "";
}

function attr(xml, name, attribute) {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*\\b${attribute}\\s*=\\s*["']([^"']+)["']`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

function plain(html, max) {
  const text = decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " "))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function seconds(d) {
  if (!d) return 0;
  if (/^\d+$/.test(d)) return Number(d);
  const parts = d.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function parseFeed(xml) {
  const channel = xml.split(/<item[\s>]/i)[0];
  const image = attr(channel, "itunes:image", "href") || tag(tag(channel, "image"), "url");
  const items = xml.split(/<item[\s>]/i).slice(1).map((chunk) => chunk.split(/<\/item>/i)[0]);
  const episodes = [];
  for (const item of items) {
    const url = attr(item, "enclosure", "url");
    const type = attr(item, "enclosure", "type");
    if (!url || (type && !type.startsWith("audio") && !/\.(mp3|m4a|aac|ogg)(\?|$)/i.test(url))) continue;
    const guid = tag(item, "guid") || url;
    const date = Date.parse(tag(item, "pubDate")) || 0;
    episodes.push({
      id: hash(guid),
      title: plain(tag(item, "title"), 160),
      url,
      date,
      duration: seconds(tag(item, "itunes:duration")),
      desc: plain(tag(item, "description") || tag(item, "itunes:summary") || tag(item, "content:encoded"), 220),
      image: attr(item, "itunes:image", "href") || undefined,
    });
  }
  episodes.sort((a, b) => b.date - a.date);
  return {
    title: plain(tag(channel, "title"), 120),
    author: plain(tag(channel, "itunes:author"), 80),
    desc: plain(tag(channel, "description") || tag(channel, "itunes:summary"), 260),
    link: tag(channel, "link"),
    image,
    episodes: episodes.slice(0, EPISODES_PER_SHOW),
  };
}

async function get(url, timeout = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function search(term, genreId) {
  const genre = genreId ? `&genreId=${genreId}` : "";
  const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&country=TH&limit=50${genre}&term=${encodeURIComponent(term)}`;
  try {
    return JSON.parse(await get(url)).results ?? [];
  } catch (e) {
    console.warn(`search "${term}"${genre} failed: ${e.message}`);
    return [];
  }
}

const hasThai = (s) => /[\u0E00-\u0E7F]/.test(s);

/** Best-fitting category for a show, or null. Genre match beats keywords in the name beats description. */
export function classify(name, desc, genreIds) {
  let best = null;
  let bestScore = 0;
  const n = name.toLowerCase();
  const d = desc.toLowerCase();
  for (const cat of CATEGORIES) {
    let score = 0;
    if (cat.genres.some((g) => genreIds.includes(g))) score += 3;
    if (cat.keywords.some((k) => n.includes(k.toLowerCase()))) score += 4;
    if (cat.keywords.some((k) => d.includes(k.toLowerCase()))) score += 1;
    if (score > bestScore) {
      best = cat.id;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}

async function main() {
  const local = process.argv.find((a) => a.startsWith("--feed="));
  if (local) {
    console.log(JSON.stringify(parseFeed(fs.readFileSync(local.slice(7), "utf8")), null, 2));
    return;
  }

  // 1) Collect candidates: keyword searches + the same words restricted to each category's genres.
  const candidates = new Map(); // collectionId → iTunes result
  for (const cat of CATEGORIES) {
    for (const term of cat.terms) {
      for (const r of await search(term)) if (r.feedUrl) candidates.set(r.collectionId, r);
      await new Promise((ok) => setTimeout(ok, 350)); // be polite to the search API
    }
    for (const g of cat.genres) {
      for (const term of ["ไทย", "thai", "เรื่อง"]) {
        for (const r of await search(term, g)) if (r.feedUrl) candidates.set(r.collectionId, r);
        await new Promise((ok) => setTimeout(ok, 350));
      }
    }
  }
  console.log(`${candidates.size} candidate shows`);

  // 2) Read feeds, keep Thai-language, recently active (evergreen genres may be older), classify.
  const shows = [];
  const queue = [...candidates.values()].filter((r) => {
    const genres = (r.genreIds ?? []).map(String);
    if (genres.some((g) => EXCLUDE_GENRES.has(g)) && !genres.some((g) => CATEGORIES.some((c) => c.genres.includes(g)))) return false;
    return !EXCLUDE_WORDS.test(r.collectionName ?? "");
  });
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const r = queue.shift();
        try {
          const feed = parseFeed(await get(r.feedUrl));
          if (!feed.episodes.length) continue;
          const name = feed.title || r.collectionName;
          if (!hasThai(`${name} ${feed.desc} ${feed.episodes[0].title}`)) continue;
          const category = classify(name, feed.desc, (r.genreIds ?? []).map(String));
          if (!category) continue;
          const cat = CATEGORIES.find((c) => c.id === category);
          const maxAge = (cat.evergreen ? 6 : 2) * 365 * 864e5;
          if (feed.episodes[0].date && Date.now() - feed.episodes[0].date > maxAge) continue;
          shows.push({
            id: `pod-${r.collectionId}`,
            category,
            name,
            author: feed.author || r.artistName || "",
            desc: feed.desc,
            image: r.artworkUrl600 || feed.image || "",
            link: feed.link || r.collectionViewUrl || "",
            feed: r.feedUrl,
            episodes: feed.episodes,
          });
        } catch (e) {
          console.warn(`feed ${r.collectionName}: ${e.message}`);
        }
      }
    }),
  );

  // 3) Drop duplicate shows (same title re-published under another feed), cap each category.
  const seenNames = new Set();
  const unique = shows
    .sort((a, b) => (b.episodes[0]?.date ?? 0) - (a.episodes[0]?.date ?? 0))
    .filter((x) => {
      const k = x.name.toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");
      if (seenNames.has(k)) return false;
      seenNames.add(k);
      return true;
    });
  shows.length = 0;
  shows.push(...unique);
  const capped = [];
  for (const cat of CATEGORIES) {
    const list = shows
      .filter((x) => x.category === cat.id)
      .sort((a, b) => (b.episodes[0]?.date ?? 0) - (a.episodes[0]?.date ?? 0))
      .slice(0, SHOWS_PER_CATEGORY);
    console.log(`${cat.label}: ${list.length}`);
    capped.push(...list);
  }
  shows.length = 0;
  shows.push(...capped);

  const order = Object.fromEntries(CATEGORIES.map((c, i) => [c.id, i]));
  shows.sort((a, b) => order[a.category] - order[b.category] || (b.episodes[0]?.date ?? 0) - (a.episodes[0]?.date ?? 0));
  const out = {
    updatedAt: new Date().toISOString(),
    categories: CATEGORIES.map(({ id, label }) => ({ id, label })),
    shows,
  };
  if (shows.length < 5) {
    console.error(`Only ${shows.length} shows — keeping the previous podcasts.json`);
    process.exit(0);
  }
  fs.writeFileSync("public/podcasts.json", JSON.stringify(out));
  console.log(`Wrote ${shows.length} shows, ${shows.reduce((n, s) => n + s.episodes.length, 0)} episodes`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
