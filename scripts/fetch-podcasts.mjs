// Builds public/podcasts.json — the catalogue for the "เรื่องเล่า" (stories) mode.
// Runs in CI (needs internet): finds Thai podcasts per category with the iTunes Search API,
// reads each show's public RSS feed and keeps the latest episodes.
// Audio is streamed straight from each publisher's host; nothing is re-hosted.
//
//   node scripts/fetch-podcasts.mjs            → writes public/podcasts.json
//   node scripts/fetch-podcasts.mjs --feed=FILE → parse a local RSS file (for testing)
import fs from "node:fs";
import crypto from "node:crypto";

export const CATEGORIES = [
  { id: "horror", label: "สยองขวัญ", terms: ["เรื่องผี", "เล่าเรื่องผี", "the ghost radio", "สยองขวัญ", "เรื่องหลอน"] },
  { id: "story", label: "เรื่องเล่า", terms: ["เล่าเรื่อง", "เรื่องเล่า", "เรื่องจริง", "ประสบการณ์"] },
  { id: "mystery", label: "คดี & ลึกลับ", terms: ["คดีดัง", "คดีฆาตกรรม", "เรื่องลึกลับ", "true crime thai"] },
  { id: "knowledge", label: "ความรู้", terms: ["ความรู้", "วิทยาศาสตร์", "รอบรู้", "สารคดี"] },
  { id: "history", label: "ประวัติศาสตร์", terms: ["ประวัติศาสตร์", "ประวัติศาสตร์ไทย", "ย้อนอดีต"] },
  { id: "novel", label: "นิยายเสียง", terms: ["นิยายเสียง", "หนังสือเสียง", "อ่านนิยาย", "นิทาน"] },
  { id: "drama", label: "ภาพยนตร์ & ละครเสียง", terms: ["ละครเสียง", "ละครวิทยุ", "audio drama thai", "หนังเสียง"] },
  { id: "self", label: "พัฒนาตัวเอง", terms: ["พัฒนาตัวเอง", "จิตวิทยา", "แรงบันดาลใจ"] },
  { id: "business", label: "ธุรกิจ & การเงิน", terms: ["ธุรกิจ", "การเงิน", "การลงทุน"] },
  { id: "dharma", label: "ธรรมะ", terms: ["ธรรมะ", "ฟังธรรม"] },
];

const SHOWS_PER_CATEGORY = 10;
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

async function search(term) {
  const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&country=TH&limit=15&term=${encodeURIComponent(term)}`;
  try {
    return JSON.parse(await get(url)).results ?? [];
  } catch (e) {
    console.warn(`search "${term}" failed: ${e.message}`);
    return [];
  }
}

async function main() {
  const local = process.argv.find((a) => a.startsWith("--feed="));
  if (local) {
    console.log(JSON.stringify(parseFeed(fs.readFileSync(local.slice(7), "utf8")), null, 2));
    return;
  }

  const picked = new Map(); // collectionId → { result, category }
  for (const cat of CATEGORIES) {
    let count = 0;
    for (const term of cat.terms) {
      for (const r of await search(term)) {
        if (count >= SHOWS_PER_CATEGORY) break;
        if (!r.feedUrl || picked.has(r.collectionId)) continue;
        picked.set(r.collectionId, { r, category: cat.id });
        count += 1;
      }
      if (count >= SHOWS_PER_CATEGORY) break;
      await new Promise((ok) => setTimeout(ok, 400)); // be polite to the search API
    }
    console.log(`${cat.label}: ${count} shows`);
  }

  const shows = [];
  const queue = [...picked.values()];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const { r, category } = queue.shift();
        try {
          const feed = parseFeed(await get(r.feedUrl));
          if (!feed.episodes.length) continue;
          // Skip shows that went quiet more than two years ago.
          if (feed.episodes[0].date && Date.now() - feed.episodes[0].date > 2 * 365 * 864e5) continue;
          shows.push({
            id: `pod-${r.collectionId}`,
            category,
            name: feed.title || r.collectionName,
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
