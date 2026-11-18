#!/usr/bin/env node
/**
 * Builds public/dharma.json for the "ธรรมะ" mode.
 *
 * Sources (all free to listen, published by monasteries, disciples or the teachers' own channels):
 *   1. Internet Archive (archive.org) audio items — each item, and each folder inside an item,
 *      becomes one "ชุด / วาระ" (album) with its tracks in order.
 *   2. Public podcasts on Apple Podcasts (Thai storefront) — each podcast becomes one album.
 *
 * Output shape (compact on purpose, the app expands it):
 *   { updatedAt, topics:[{id,label}], teachers:[{id,name,full,place,blurb,albums:[
 *       { id, title, topic, src: "archive"|"podcast", link, base, year?, n, dur,
 *         tracks: [{ t: title, u: url (relative to base), d: seconds }] } ]}] }
 *
 * Run: node scripts/fetch-dharma.mjs            (needs network; runs in CI)
 *      node scripts/fetch-dharma.mjs --dry       (prints summary, doesn't write)
 */
import fs from "node:fs";
import { parseFeed } from "./fetch-podcasts.mjs";

const UA = "Mozilla/5.0 (compatible; DoT-app/1.0; +https://github.com/mengnattawitmarin/dot-app)";
const DRY = process.argv.includes("--dry");

/** Teachers, in the order they appear in the app. `max` = albums kept. */
export const TEACHERS = [
  {
    id: "ruesi",
    name: "หลวงพ่อฤาษีลิงดำ",
    full: "พระราชพรหมยาน (หลวงพ่อฤาษีลิงดำ)",
    place: "วัดจันทาราม (ท่าซุง) อุทัยธานี",
    blurb: "กรรมฐาน ๔๐ มโนมยิทธิ พระโสดาบัน คำสอนตอนเช้า-เย็น และเรื่องเล่าจากวัดท่าซุง",
    terms: ["ฤาษีลิงดำ", "ฤๅษีลิงดำ", "ฤาษีลิงดํา", "ฤษีลิงดำ", "พระราชพรหมญาณ", "หลวงพ่อฤาษี", "หลวงพ่อฤๅษี", "lingdam", "พระราชพรหมยาน", "หลวงพ่อพระราชพรหมยาน", "วัดท่าซุง", "ท่าซุง", "วีระ ถาวโร", "ruesi ling dam", "ratchaphromyan", "watthasung", "wat tha sung"],
    search: ["ฤาษีลิงดำ", "ฤๅษีลิงดำ", "ฤษีลิงดำ", "ลิงดำ", "พระราชพรหมยาน", "พระราชพรหมญาณ", "วัดท่าซุง", "ท่าซุง", "หลวงพ่อฤาษี", "หลวงพ่อฤๅษี", "\"วีระ ถาวโร\"", "\"ruesi\"", "lingdam", "thasung", "watthasung", "ratchaphromyan", "\"luang por ruesi\""],
    pods: ["หลวงพ่อฤาษีลิงดำ", "ฤาษีลิงดำ", "พระราชพรหมยาน", "วัดท่าซุง", "หลวงพ่อมหาวีระ"],
    descOk: true, // names are unique enough to trust item descriptions
    max: 160,
  },
  {
    id: "mahabua",
    name: "หลวงตามหาบัว",
    full: "หลวงตาพระมหาบัว ญาณสมฺปนฺโน",
    place: "วัดป่าบ้านตาด อุดรธานี",
    blurb: "พระธรรมเทศนาสายพระป่า อบรมพระ อบรมฆราวาส และเทศน์แปลภาษาอังกฤษ",
    terms: ["มหาบัว", "ญาณสัมปันโน", "ญาณสมฺปนฺโน", "บ้านตาด", "maha bua", "mahabua", "maha boowa", "luangta", "ajahn maha", "baan taad", "ban tat"],
    search: ["หลวงตามหาบัว", "มหาบัว", "วัดป่าบ้านตาด", "\"maha bua\"", "mahabua", "\"maha boowa\"", "luangta"],
    pods: ["หลวงตามหาบัว", "หลวงตาบัว", "วัดป่าบ้านตาด"],
    max: 80,
  },
  {
    id: "jayasaro",
    name: "พระอาจารย์ชยสาโร",
    full: "พระอาจารย์ชยสาโร ภิกขุ",
    place: "บ้านบุญ ปากช่อง นครราชสีมา",
    blurb: "ธรรมะเข้าใจง่ายสำหรับชีวิตประจำวัน การศึกษา ครอบครัว และการภาวนา",
    terms: ["ชยสาโร", "ชยสาโรภิกขุ", "jayasaro"],
    search: ["ชยสาโร", "jayasaro"],
    pods: ["ชยสาโร", "พระอาจารย์ชยสาโร", "Jayasaro"],
    max: 60,
  },
  {
    id: "buddhadasa",
    name: "ท่านพุทธทาสภิกขุ",
    full: "พระธรรมโกศาจารย์ (พุทธทาสภิกขุ)",
    place: "สวนโมกขพลาราม สุราษฎร์ธานี",
    blurb: "ธรรมบรรยายสวนโมกข์ ตัวกู-ของกู จิตว่าง อานาปานสติ และธรรมะกับการเมือง",
    terms: ["พุทธทาส", "สวนโมกข", "buddhadasa", "suan mokkh", "suanmokkh"],
    exclude: ["a.d.m", "a. d. m", "daham", "abhidhamma", "abhdhamma", "nirwana", "dhammavidu"],
    search: ["พุทธทาส", "สวนโมกข์", "buddhadasa", "suanmokkh"],
    pods: ["พุทธทาส", "ท่านพุทธทาส", "สวนโมกข์"],
    max: 80,
  },
  {
    id: "chah",
    name: "หลวงพ่อชา สุภัทโท",
    full: "พระโพธิญาณเถร (หลวงพ่อชา สุภทฺโท)",
    place: "วัดหนองป่าพง อุบลราชธานี",
    blurb: "เทศน์สายพระป่า ตรงไปตรงมา ใช้อุปมาเข้าใจง่าย",
    terms: ["หลวงพ่อชา", "สุภัทโท", "สุภทฺโท", "หนองป่าพง", "ajahn chah", "ajahnchah"],
    search: ["หลวงพ่อชา", "หนองป่าพง", "\"ajahn chah\""],
    pods: ["หลวงพ่อชา", "วัดหนองป่าพง"],
    max: 40,
  },
  {
    id: "pramote",
    name: "หลวงพ่อปราโมทย์ ปาโมชฺโช",
    full: "หลวงพ่อปราโมทย์ ปาโมชฺโช",
    place: "วัดสวนสันติธรรม ชลบุรี",
    blurb: "ดูจิต รู้กาย รู้ใจ ตามความเป็นจริง สำหรับคนเมือง",
    terms: ["ปราโมทย์", "ปาโมชฺโช", "ปาโมชโช", "สวนสันติธรรม", "pramote"],
    search: ["ปราโมทย์ ปาโมชฺโช", "หลวงพ่อปราโมทย์", "สวนสันติธรรม", "pramote"],
    pods: ["หลวงพ่อปราโมทย์", "ปราโมทย์ ปาโมชฺโช", "วัดสวนสันติธรรม"],
    max: 40,
  },
  {
    id: "paisal",
    name: "พระไพศาล วิสาโล",
    full: "พระไพศาล วิสาโล",
    place: "วัดป่าสุคะโต ชัยภูมิ",
    blurb: "ธรรมะหลังทำวัตร การเผชิญความตาย ความสุขในชีวิตประจำวัน",
    terms: ["ไพศาล", "วิสาโล", "สุคะโต", "paisal", "visalo"],
    search: ["ไพศาล วิสาโล", "หลวงพ่อไพศาล", "PhraPaisal", "visalo"],
    pods: ["พระไพศาล วิสาโล", "ไพศาล วิสาโล"],
    max: 40,
  },
  {
    id: "jaran",
    name: "หลวงพ่อจรัญ ฐิตธมฺโม",
    full: "พระพรหมมังคลาจารย์ (หลวงพ่อจรัญ ฐิตธมฺโม)",
    place: "วัดอัมพวัน สิงห์บุรี",
    blurb: "กฎแห่งกรรม สติปัฏฐาน ๔ และเรื่องกรรมที่คนชอบฟัง",
    terms: ["หลวงพ่อจรัญ", "ฐิตธมฺโม", "ฐิตธัมโม", "วัดอัมพวัน", "luang por jaran"],
    search: ["หลวงพ่อจรัญ", "วัดอัมพวัน", "ฐิตธมฺโม"],
    pods: ["หลวงพ่อจรัญ", "วัดอัมพวัน กฎแห่งกรรม"],
    max: 40,
  },
  {
    id: "vajiramedhi",
    name: "ท่าน ว.วชิรเมธี",
    full: "พระเมธีวชิโรดม (ว.วชิรเมธี)",
    place: "ไร่เชิญตะวัน เชียงราย",
    blurb: "ธรรมะร่วมสมัย คมคิด ใช้ได้จริงกับงานและชีวิต",
    terms: ["วชิรเมธี", "ว.วชิรเมธี", "เชิญตะวัน", "vajiramedhi"],
    search: ["วชิรเมธี", "vajiramedhi"],
    pods: ["ว.วชิรเมธี", "วชิรเมธี", "ไร่เชิญตะวัน"],
    max: 30,
  },
  {
    id: "narongsak",
    name: "หลวงตาณรงค์ศักดิ์ ขีณาลโย",
    full: "หลวงตาณรงค์ศักดิ์ ขีณาลโย",
    place: "สวนป่าสุญญตาธรรม ลพบุรี",
    blurb: "สนทนาธรรมสายหลวงพ่อเทียน การเจริญสติแบบเคลื่อนไหว",
    terms: ["ณรงค์ศักดิ์", "ขีณาลโย", "สุญญตาธรรม"],
    descOk: true,
    search: ["หลวงตาณรงค์ศักดิ์", "ขีณาลโย"],
    pods: ["หลวงตาณรงค์ศักดิ์"],
    max: 20,
  },
  {
    id: "teean",
    name: "หลวงพ่อเทียน จิตฺตสุโภ",
    full: "หลวงพ่อเทียน จิตฺตสุโภ",
    place: "วัดสนามใน นนทบุรี",
    blurb: "เจริญสติแบบเคลื่อนไหว รู้สึกตัวทั่วพร้อม",
    terms: ["หลวงพ่อเทียน", "จิตฺตสุโภ", "จิตตสุโภ", "luang por teean", "luangpor teean"],
    search: ["หลวงพ่อเทียน", "\"luang por teean\""],
    pods: ["หลวงพ่อเทียน"],
    max: 20,
  },
  {
    id: "phayom",
    name: "พระพยอม กัลยาโณ",
    full: "พระราชธรรมนิเทศ (พระพยอม กัลยาโณ)",
    place: "วัดสวนแก้ว นนทบุรี",
    blurb: "เทศน์สนุก ตลก แฝงข้อคิด ฟังเพลินทั้งครอบครัว",
    terms: ["พยอม", "กัลยาโณ", "วัดสวนแก้ว"],
    search: ["พระพยอม", "พยอม กัลยาโณ"],
    pods: ["พระพยอม", "พระพยอม กัลยาโณ"],
    max: 20,
  },
  {
    id: "sompong",
    name: "พระมหาสมปอง ตาลปุตฺโต",
    full: "พระมหาสมปอง ตาลปุตฺโต",
    place: "วัดสร้อยทอง กรุงเทพฯ",
    blurb: "เทศน์ฮาแบบมีสาระ ข้อคิดสำหรับคนรุ่นใหม่",
    terms: ["สมปอง", "ตาลปุตฺโต", "ตาลปุตโต"],
    search: ["พระมหาสมปอง"],
    pods: ["พระมหาสมปอง", "พระมหาสมปอง ตาลปุตฺโต"],
    max: 20,
  },
  {
    id: "lee",
    name: "ท่านพ่อลี ธมฺมธโร",
    full: "พระสุทธิธรรมรังสีคัมภีรเมธาจารย์ (ท่านพ่อลี)",
    place: "วัดอโศการาม สมุทรปราการ",
    blurb: "พระธรรมเทศนาสายพระป่า สมาธิ และการใช้ลมหายใจ",
    terms: ["ท่านพ่อลี", "ธมฺมธโร", "ธัมมธโร", "อโศการาม", "ajaan lee"],
    search: ["ท่านพ่อลี", "วัดอโศการาม"],
    pods: ["ท่านพ่อลี"],
    max: 15,
  },
];

/** Topics an album can fall into. First match wins, so the order matters. */
export const TOPICS = [
  { id: "chant", label: "สวดมนต์ · คาถา", words: ["สวดมนต์", "ทำวัตร", "บทสวด", "คาถา", "พระปริตร", "ชินบัญชร", "อิติปิโส", "chant", "เจริญพระพุทธมนต์"] },
  { id: "qa", label: "ถาม-ตอบ · สนทนาธรรม", words: ["ตอบปัญหา", "ถามตอบ", "ถาม-ตอบ", "ถาม ตอบ", "สนทนาธรรม", "ปุจฉา", "วิสัชนา", "q&a", "questions"] },
  { id: "meditation", label: "กรรมฐาน · ฝึกจิต", words: ["กรรมฐาน", "กัมมัฏฐาน", "สมาธิ", "วิปัสสนา", "สมถะ", "อานาปา", "มโนมยิทธิ", "กสิณ", "ภาวนา", "ดูจิต", "เจริญสติ", "สติปัฏฐาน", "ทิพจักขุ", "อภิญญา", "นั่งสมาธิ", "เดินจงกรม", "meditation", "mindfulness", "breath", "concentration"] },
  { id: "path", label: "มรรคผล · นิพพาน", words: ["นิพพาน", "สังโยชน์", "โสดาบัน", "โสดา", "อริยะ", "อริยมรรค", "อรหันต์", "อนาคามี", "สกิทาคามี", "วิมุตติ", "หลุดพ้น", "จิตว่าง", "ความว่าง", "สุญญตา", "อนัตตา", "ตัวกู", "nibbana", "arahant", "emptiness"] },
  { id: "sutta", label: "พระสูตร · พุทธวจน", words: ["พระสูตร", "สูตร", "พระไตรปิฎก", "อภิธรรม", "พุทธวจน", "ธรรมจักร", "มงคล ๓๘", "มงคล 38", "ปฏิจจ", "อริยสัจ", "ไตรลักษณ์", "sutta", "noble truth"] },
  { id: "story", label: "ประวัติ · ตำนาน · นิทานธรรม", words: ["ประวัติ", "ตำนาน", "นิทาน", "ชาดก", "พุทธประวัติ", "อดีตชาติ", "เรื่องเล่า", "เล่าเรื่อง", "บันทึก", "biography", "history"] },
  { id: "karma", label: "กฎแห่งกรรม · บุญบาป", words: ["กฎแห่งกรรม", "กฎแห่ง", "วิบาก", "บุญ", "บาป", "ทำบุญ", "ทาน", "ศีล", "เวรกรรม", "ผลกรรม", "karma"] },
  { id: "life", label: "ธรรมะกับชีวิต", words: ["ชีวิต", "ครอบครัว", "ความสุข", "ความทุกข์", "การงาน", "ความรัก", "พ่อแม่", "ลูก", "สุขภาพ", "ความตาย", "เผชิญความตาย", "แก่", "เจ็บ", "การศึกษา", "สังคม", "life", "happiness", "family", "death"] },
  { id: "talk", label: "ธรรมเทศนา", words: [] },
];

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";
const arabic = (s) => s.replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { timeout = 25000, json = false, tries = 3 } = {}) {
  for (let attempt = 1; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return json ? await res.json() : await res.text();
    } catch (e) {
      if (attempt >= tries) throw e;
      await sleep(1500 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Run `fn` over `items` with at most `n` in flight. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        try {
          out[k] = await fn(items[k], k);
        } catch (e) {
          out[k] = null;
          console.warn(`  ! ${String(items[k]?.id ?? items[k]).slice(0, 60)}: ${e.message}`);
        }
      }
    }),
  );
  return out;
}

/** TIS-620 bytes that were read as Latin-1 ("ªÕÇÔµ") → Thai. */
export function fixThai(s) {
  if (!/[\u00a1-\u00fb]{2,}/.test(s) || /[\u0e00-\u0e7f]/.test(s)) return s;
  return s.replace(/[\u00a1-\u00fb]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xa0 + 0x0e00));
}

/** Text that is neither Thai nor plain English (garbled, Vietnamese, French, Sinhala…). */
export function foreign(s) {
  return /[\u00a0-\u024f\u0370-\u0dff\u0e80-\u1fff]/.test(s.replace(/[\u00a0\u00b7\u00d7]/g, ""));
}

const OTHER_LANG = /\b(cua|nhung|loi|gioi|thieu|phap|thien|ngai|duong|giai|thoat|voi|trong|tinh|lang|huong|suoi|nguon|chi la|coi|audiolivre|il n'y|pas d|la pratique|notre|demeure|l'équilibre|méditation|trouver|enseignement)\b/gi;

/** Album that's in Vietnamese / French etc. written without Thai script. */
export function otherLanguage(title, trackTitles = []) {
  const text = [title, ...trackTitles.slice(0, 6)].join(" ");
  if (/[\u0e00-\u0e7f]/.test(text)) return false;
  if (foreign(text)) return true;
  return (text.match(OTHER_LANG) ?? []).length >= 2;
}

export function clean(s, max = 140) {
  const text = fixThai(String(s ?? ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const first = (v) => (Array.isArray(v) ? v[0] : v) ?? "";
const joined = (v) => (Array.isArray(v) ? v.join(" ") : String(v ?? ""));

/** "12:34", "1:02:03" or "754.3" → seconds. */
export function toSeconds(v) {
  if (v == null || v === "") return 0;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const parts = s.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return Math.round(parts.reduce((acc, n) => acc * 60 + n, 0));
}

/** Natural sort key: numbers (Thai or Arabic digits) compare numerically. */
export function naturalCompare(a, b) {
  return arabic(a).localeCompare(arabic(b), "th", { numeric: true, sensitivity: "base" });
}

/** A readable track title from an archive.org file record. */
export function trackTitle(file) {
  const meta = clean(first(file.title), 120);
  const base = decodeURIComponent(file.name.split("/").pop() ?? file.name).replace(/\.[a-z0-9]{2,4}$/i, "");
  const fromName = clean(base.replace(/[_]+/g, " ").replace(/\s*-\s*$/, "").replace(/\s{2,}/g, " "), 120);
  // Prefer the embedded title when it's real text, not just the file name again or a number.
  if (meta && !/^(track\s*)?\d+$/i.test(meta) && meta.length > 2 && !foreign(meta)) return meta;
  const name = (!foreign(fromName) && fromName) || (!foreign(meta) && meta) || "";
  if (!name) return "";
  return /^\d{1,3}$/.test(arabic(name)) ? `ตอนที่ ${Number(arabic(name))}` : name;
}

export function topicOf(text) {
  const t = text.toLowerCase();
  for (const topic of TOPICS) if (topic.words.some((w) => t.includes(w.toLowerCase()))) return topic.id;
  return "talk";
}

/** Buddhist-era or CE year mentioned in a title/date, as a BE year. */
export function yearOf(...texts) {
  for (const raw of texts) {
    const s = arabic(String(raw ?? ""));
    const be = s.match(/(?:พ\.?\s?ศ\.?\s?)?(25[0-6]\d)/);
    if (be) return Number(be[1]);
    const ce = s.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
    if (ce) return Number(ce[1]) + 543;
  }
  // Talks are often named by BE date: 540110, PS590227am…
  for (const raw of texts) {
    const m = arabic(String(raw ?? "")).match(/(?:^|\D)([3-6]\d)(0[1-9]|1[0-2])([0-3]\d)(?!\d)/);
    if (m) return 2500 + Number(m[1]);
  }
  return undefined;
}

const AUDIO = /\.(mp3|m4a)$/i;

/** Topic for an album: from its title first, else what most of its talks are about. */
export function albumTopic(title, trackTitles) {
  const own = topicOf(title);
  if (own !== "talk") return own;
  const votes = {};
  for (const t of trackTitles) {
    const k = topicOf(t);
    if (k !== "talk") votes[k] = (votes[k] ?? 0) + 1;
  }
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= Math.max(2, trackTitles.length * 0.35) ? best[0] : "talk";
}

/** "คำสอน… ชุดที่ 04/13" → { group: "คำสอน…", part: "ชุดที่ 04/13" } */
export function splitSeries(title) {
  const m = title.match(/^(.{6,}?)[\s\-–:|]*((?:ชุดที่|ชุด|แผ่นที่|แผ่น|ภาคที่|ภาค|เล่มที่|เล่ม|ม้วนที่|ตอนที่|cd|disc|part|vol\.?)\s*[\d๐-๙]+.*)$/i);
  if (!m) return null;
  return { group: m[1].trim(), part: m[2].trim() };
}

/**
 * Turns an archive.org metadata record into albums: one per folder inside the item (that's how
 * uploaders usually separate sessions/วาระ), or one for the whole item.
 */
export function albumsFromItem(meta, teacher) {
  const id = meta?.metadata?.identifier;
  if (!id || !Array.isArray(meta.files)) return [];
  const md = meta.metadata;
  const itemTitle = clean(first(md.title), 120) || id;
  const files = meta.files.filter((f) => AUDIO.test(f.name) && !/(^|\/)__MACOSX\//.test(f.name) && !/_sample\.|\._/i.test(f.name));
  if (!files.length) return [];
  // Prefer original MP3s; fall back to derivative MP3s of other formats. One per base name.
  const byBase = new Map();
  for (const f of files) {
    const key = f.name.replace(/\.[^.]+$/, "").replace(/_vbr$|_64kb$|_128kb$/i, "");
    const prev = byBase.get(key);
    const score = (x) => (x.source === "original" ? 3 : 0) + (/_64kb/i.test(x.name) ? -1 : 0) + (/vbr/i.test(x.format ?? "") ? 1 : 0);
    if (!prev || score(f) > score(prev)) byBase.set(key, f);
  }
  const groups = new Map();
  for (const f of byBase.values()) {
    const dir = f.name.includes("/") ? f.name.slice(0, f.name.lastIndexOf("/")) : "";
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(f);
  }
  const base = `https://archive.org/download/${encodeURIComponent(id)}/`;
  const link = `https://archive.org/details/${encodeURIComponent(id)}`;
  const desc = clean(joined(md.description), 300);
  const albums = [];
  const dirs = [...groups.keys()].sort(naturalCompare);
  for (const dir of dirs) {
    const list = groups.get(dir).sort((a, b) => naturalCompare(a.name, b.name)).slice(0, 400);
    const folder = dir ? clean(dir.split("/").pop().replace(/_/g, " "), 90) : "";
    const useFolder = dirs.length > 1 && folder && !foreign(folder);
    const tracks = list.map((f, i) => ({ t: trackTitle(f) || `ตอนที่ ${i + 1}`, u: f.name, d: toSeconds(f.length) }));
    let title = useFolder ? folder : itemTitle;
    let group = useFolder ? itemTitle : undefined;
    if (!group) {
      const series = splitSeries(title);
      if (series) [group, title] = [series.group, series.part];
    }
    if (otherLanguage(`${group ?? ""} ${title}`, tracks.map((x) => x.t))) continue;
    albums.push({
      id: `ia-${hash(`${id}/${dir}`)}`,
      title,
      group,
      // Parts of a series stay together under the series' topic.
      topic: group ? albumTopic(group, []) : albumTopic(title, tracks.map((x) => x.t)),
      src: "archive",
      link,
      base,
      year: yearOf(folder, itemTitle, first(md.date), tracks[0]?.t),
      desc: desc || undefined,
      n: tracks.length,
      dur: tracks.reduce((s, x) => s + x.d, 0),
      tracks,
      _item: itemTitle,
      _teacher: teacher.id,
      _pop: Number(md.downloads ?? 0),
    });
  }
  return albums;
}

/** Does this text clearly belong to the teacher? */
export function mentions(teacher, text) {
  const t = text.toLowerCase();
  return teacher.terms.some((term) => t.includes(term.toLowerCase()));
}

const PERSON = /\b(ajahn|ajaan|ajarn|achaan|acharn|luang ?p[ou]r?|bhikkhu|venerable|ven\.|talks? by)\s+[a-z]\S*|(หลวงพ่อ|หลวงปู่|หลวงตา|พระอาจารย์|พระอ\.|อาจารย์|อ\.|ครูบา|ท่านพ่อ|ท่านอาจารย์|พระมหา)\s*[ก-ฮ]\S*/i;

/** Is this item about our teacher (and not about someone else, or in another language)? */
export function relevant(teacher, doc) {
  const title = clean(joined(doc.title), 200);
  if (!title || foreign(title)) return false;
  const lower = `${title} ${joined(doc.subject)} ${joined(doc.creator)} ${joined(doc.description).slice(0, 600)}`.toLowerCase();
  if ((teacher.exclude ?? []).some((x) => lower.includes(x))) return false;
  if (mentions(teacher, title)) return true;
  // Someone else is named in the title → it's theirs.
  if (PERSON.test(title) || TEACHERS.some((o) => o.id !== teacher.id && mentions(o, title))) return false;
  if (mentions(teacher, `${joined(doc.subject)} ${joined(doc.creator)}`)) return true;
  return Boolean(teacher.descOk) && mentions(teacher, joined(doc.description).slice(0, 2000));
}

async function archiveSearch(term) {
  const q = `(${term}) AND mediatype:(audio OR etree)`;
  const fl = ["identifier", "title", "description", "subject", "creator", "downloads", "item_size"].map((f) => `fl[]=${f}`).join("&");
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&${fl}&rows=400&page=1&output=json&sort[]=downloads+desc`;
  try {
    const data = await get(url, { json: true });
    return data?.response?.docs ?? [];
  } catch (e) {
    console.warn(`archive search "${term}" failed: ${e.message}`);
    return [];
  }
}

async function itunesSearch(term) {
  const url = `https://itunes.apple.com/search?media=podcast&entity=podcast&country=TH&limit=50&term=${encodeURIComponent(term)}`;
  try {
    return (await get(url, { json: true })).results ?? [];
  } catch (e) {
    console.warn(`itunes "${term}" failed: ${e.message}`);
    return [];
  }
}

/** Key for grouping single-talk items that belong together ("ภาษาคน ภาษาธรรม ตอนที่ 3"). */
function seriesKey(teacher, title) {
  let t = title.toLowerCase();
  for (const term of teacher.terms) t = t.split(term.toLowerCase()).join(" ");
  return t
    .replace(/ตอนที่|ตอน|ภาคพิเศษ|ภาค|ภิกขุ|ภิกษุ|อ\.|หลวงพ่อ|ท่าน|ep\.?|part/g, " ")
    .replace(/[\d๐-๙]+/g, " ")
    .replace(/[^\p{L}\p{M}]+/gu, " ")
    .trim();
}

/**
 * Many uploaders put one talk per archive item. Gather those: items whose titles differ only by
 * a number become one album; the rest go into a single "เทศน์เดี่ยว" album, titled per talk.
 */
export function consolidate(teacher, albums) {
  const small = albums.filter((a) => a.src === "archive" && a.n <= 2);
  const full = (a) => `${a.group ?? ""} ${a.title}`.trim();
  const rest = albums.filter((a) => !small.includes(a));
  const byKey = new Map();
  for (const a of small) {
    const key = seriesKey(teacher, full(a));
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(a);
  }
  const loose = [];
  const absolute = (a, t) => ({ ...t, u: a.base + t.u.split("/").map(encodeURIComponent).join("/") });
  for (const [key, list] of byKey) {
    if (list.length < 3 || key.length < 3) {
      loose.push(...list);
      continue;
    }
    list.sort((a, b) => naturalCompare(full(a), full(b)));
    const named = /[฀-๿]/.test(key) || key.split(" ").length > 1;
    const tracks = list.flatMap((a) => a.tracks.map((t, i) => absolute(a, { ...t, t: a.n > 1 ? `${full(a)} (${i + 1})` : full(a) })));
    rest.push({
      ...list[0],
      id: `ia-s-${hash(list.map((a) => a.id).join())}`,
      title: list[0].group || (named ? clean(list[0].title.replace(/(ตอนที่|ตอน)?\s*[\d๐-๙]+.*$/, ""), 90) || list[0].title : `ไฟล์ชุด ${key}`),
      group: undefined,
      base: "",
      link: list[0].link,
      n: tracks.length,
      dur: tracks.reduce((s, t) => s + t.d, 0),
      topic: albumTopic(list[0].group ?? list[0].title, tracks.map((t) => t.t)),
      tracks,
      _pop: Math.max(...list.map((a) => a._pop)),
    });
  }
  if (loose.length) {
    loose.sort((a, b) => b._pop - a._pop);
    const tracks = loose.slice(0, 300).flatMap((a) => a.tracks.map((t, i) => absolute(a, { ...t, t: a.n > 1 ? `${full(a)} (${i + 1})` : full(a) })));
    rest.push({
      id: `ia-loose-${teacher.id}`,
      title: "รวมเทศน์เดี่ยว (กัณฑ์ละตอน)",
      topic: "talk",
      src: "archive",
      link: "https://archive.org/",
      base: "",
      desc: `เทศน์ทีละกัณฑ์ของ${teacher.name} จากผู้เผยแพร่หลายราย บน archive.org`,
      n: tracks.length,
      dur: tracks.reduce((s, t) => s + t.d, 0),
      tracks,
      _pop: 2e5,
    });
  }
  return rest;
}

async function collectArchive(teacher, claimed) {
  const docs = new Map();
  for (const term of teacher.search) {
    for (const d of await archiveSearch(term)) if (!docs.has(d.identifier)) docs.set(d.identifier, d);
    await sleep(300);
  }
  const keep = [...docs.values()].filter((d) => !claimed.has(d.identifier) && relevant(teacher, d) && Number(d.item_size ?? 0) < 60e9);
  keep.sort((a, b) => Number(b.downloads ?? 0) - Number(a.downloads ?? 0));
  const picked = keep.slice(0, teacher.max * 3);
  for (const d of picked) claimed.add(d.identifier);
  console.log(`  archive: ${docs.size} hits, ${keep.length} relevant, reading ${picked.length}`);
  const metas = await pool(picked, 6, (d) => get(`https://archive.org/metadata/${encodeURIComponent(d.identifier)}`, { json: true }));
  const albums = [];
  metas.forEach((m, i) => {
    if (!m) return;
    if (m.metadata && picked[i].downloads) m.metadata.downloads = picked[i].downloads;
    albums.push(...albumsFromItem(m, teacher));
  });
  return consolidate(teacher, albums);
}

async function collectPodcasts(teacher, claimed) {
  const found = new Map();
  for (const term of teacher.pods) {
    for (const r of await itunesSearch(term)) {
      if (!r.feedUrl || found.has(r.collectionId) || claimed.has(`pod:${r.collectionId}`)) continue;
      if (!relevant(teacher, { title: r.collectionName ?? "", creator: r.artistName ?? "" })) continue;
      found.set(r.collectionId, r);
    }
    await sleep(300);
  }
  for (const id of found.keys()) claimed.add(`pod:${id}`);
  console.log(`  podcasts: ${found.size}`);
  const feeds = await pool([...found.values()], 4, async (r) => {
    const feed = parseFeed(await get(r.feedUrl, { timeout: 30000, tries: 2 }), 500);
    return { r, feed };
  });
  const albums = [];
  for (const x of feeds) {
    if (!x || !x.feed.episodes.length) continue;
    const { r, feed } = x;
    // Podcasts list newest first; for teachings, oldest-first reads like a series.
    const eps = [...feed.episodes].sort((a, b) => a.date - b.date);
    const tracks = eps.map((e) => ({ t: clean(e.title, 140), u: e.url, d: e.duration || 0 }));
    const title = clean(r.collectionName || feed.title, 120);
    if (otherLanguage(title, tracks.map((t) => t.t))) continue;
    albums.push({
      id: `pc-${r.collectionId}`,
      title,
      topic: albumTopic(title, tracks.map((t) => t.t)),
      src: "podcast",
      link: r.collectionViewUrl || feed.link || "",
      base: "",
      year: undefined,
      desc: clean(feed.desc, 400) || undefined,
      image: r.artworkUrl600 || feed.image || undefined,
      n: tracks.length,
      dur: tracks.reduce((s, t) => s + t.d, 0),
      tracks,
      _teacher: teacher.id,
      _pop: 1e6, // podcasts are curated by the publisher; keep them near the top
    });
  }
  return albums;
}

/** Free English talks of Luangta Maha Bua (luangta.eu, free distribution). */
async function collectLuangtaEu() {
  try {
    const html = await get("https://luangta.eu/site/audio.php");
    const rows = html.split(/<tr[\s>]/i).slice(1);
    const tracks = [];
    for (const row of rows) {
      const href = row.match(/href="([^"]+\.mp3)"/i)?.[1];
      if (!href) continue;
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => clean(m[1], 140));
      const date = cells.find((c) => /\d{4}/.test(c) && c.length < 20) ?? "";
      const title = cells.find((c) => c && c !== date && !/^\d+'\d+$/.test(c) && !/mb$/i.test(c)) ?? href.split("/").pop();
      const dur = cells.find((c) => /^\d+'\d+$/.test(c));
      const url = new URL(href, "https://luangta.eu/site/audio.php").href;
      tracks.push({ t: date ? `${title} (${date})` : title, u: url, d: dur ? toSeconds(dur.replace("'", ":")) : 0 });
    }
    if (!tracks.length) return [];
    console.log(`  luangta.eu: ${tracks.length} talks`);
    return [
      {
        id: "lt-eu-english",
        title: "เทศน์แปลภาษาอังกฤษ (Dhamma talks in English)",
        topic: "talk",
        src: "web",
        link: "https://luangta.eu/site/audio.php",
        base: "",
        desc: "พระธรรมเทศนาหลวงตามหาบัว แปลเป็นภาษาอังกฤษโดยพระอาจารย์สุชาติ เผยแพร่เป็นธรรมทาน",
        n: tracks.length,
        dur: tracks.reduce((s, t) => s + t.d, 0),
        tracks,
        _teacher: "mahabua",
        _pop: 5e5,
      },
    ];
  } catch (e) {
    console.warn(`luangta.eu failed: ${e.message}`);
    return [];
  }
}

/** Drop albums whose track list is the same as one we already kept (re-uploads). */
function dedupe(albums) {
  const seen = new Set();
  return albums.filter((a) => {
    const sig = `${a.n}:${a.tracks.slice(0, 8).map((t) => t.t.toLowerCase().replace(/\s+/g, "")).join(";")}`;
    const name = `${a.n}:${`${a.group ?? ""}${a.title}`.toLowerCase().replace(/[.\-_ ]?\d{2,3}k$/, "").replace(/\s+/g, "")}`;
    // Same talks re-uploaded under another name: same count and (almost) the same total length.
    const size = a.n >= 10 && a.dur > 0 ? `${a.n}~${Math.round(a.dur / 600)}` : null;
    if (seen.has(sig) || seen.has(name) || (size && seen.has(size))) return false;
    seen.add(sig);
    seen.add(name);
    if (size) seen.add(size);
    return true;
  });
}

async function main() {
  const claimed = new Set();
  const out = { updatedAt: new Date().toISOString(), topics: TOPICS.map(({ id, label }) => ({ id, label })), teachers: [] };
  const extra = await collectLuangtaEu();
  for (const teacher of TEACHERS) {
    console.log(`${teacher.name}`);
    const albums = [
      ...(await collectPodcasts(teacher, claimed)),
      ...(await collectArchive(teacher, claimed)),
      ...extra.filter((a) => a._teacher === teacher.id),
    ].filter((a) => a.n > 0);
    const kept = dedupe(albums.sort((a, b) => b._pop - a._pop)).slice(0, teacher.max);
    // Order inside a teacher: topic, then series/title (parts stay together), then year.
    const order = Object.fromEntries(TOPICS.map((t, i) => [t.id, i]));
    kept.sort(
      (a, b) =>
        order[a.topic] - order[b.topic] ||
        naturalCompare(a.group ?? a.title, b.group ?? b.title) ||
        naturalCompare(a.title, b.title) ||
        (a.year ?? 9999) - (b.year ?? 9999),
    );
    const tracks = kept.reduce((s, a) => s + a.n, 0);
    console.log(`  → ${kept.length} albums, ${tracks} tracks`);
    if (!kept.length) continue;
    const { terms, search, pods, max, ...info } = teacher;
    const { exclude, descOk, ...pub } = info;
    out.teachers.push({ ...pub, albums: kept.map(({ _teacher, _pop, _item, ...a }) => a) });
  }
  const total = out.teachers.reduce((s, t) => s + t.albums.reduce((n, a) => n + a.n, 0), 0);
  console.log(`Total: ${out.teachers.length} teachers, ${total} tracks`);
  if (DRY) return;
  if (total < 50) {
    console.error("Too few tracks — keeping the previous dharma.json");
    return;
  }
  fs.writeFileSync("public/dharma.json", JSON.stringify(out));
  console.log(`Wrote public/dharma.json (${(fs.statSync("public/dharma.json").size / 1e6).toFixed(2)} MB)`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
