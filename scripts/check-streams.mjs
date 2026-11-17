// Daily stream health check. Writes public/stream-status.json with the ids whose
// every URL failed twice. Run: node --experimental-strip-types scripts/check-streams.mjs
import fs from "node:fs";
import { stations, channels, titles } from "../src/lib/catalog.ts";

const TIMEOUT = 12_000;

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-4095", "User-Agent": "Mozilla/5.0 (DoT stream check)" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (res.status >= 400) return false;
    // Read one chunk only — Icecast streams never end.
    const reader = res.body?.getReader();
    const chunk = reader ? await reader.read() : { value: undefined };
    reader?.cancel().catch(() => {});
    if (url.includes(".m3u8")) {
      const text = new TextDecoder().decode(chunk.value ?? new Uint8Array());
      return text.includes("#EXTM3U");
    }
    return Boolean(chunk.value?.length);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

async function alive(urls) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const url of urls) if (await probe(url)) return true;
  }
  return false;
}

const targets = [
  ...stations.filter((s) => s.kind === "live").map((s) => ({ id: s.id, urls: s.urls })),
  ...channels.filter((c) => c.src).map((c) => ({ id: c.id, urls: [c.src] })),
  ...titles.map((t) => ({ id: t.id, urls: [t.src] })),
];

const dead = [];
const queue = [...targets];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const t = queue.shift();
      const ok = await alive(t.urls);
      console.log(`${ok ? "ok  " : "DEAD"} ${t.id}`);
      if (!ok) dead.push(t.id);
    }
  }),
);

dead.sort();
const file = "public/stream-status.json";
const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
// Safety valve: if most things look dead the runner probably lost network — keep the old file.
if (dead.length > targets.length * 0.6) {
  console.error(`Refusing to mark ${dead.length}/${targets.length} dead; keeping previous status.`);
  process.exit(0);
}
if (JSON.stringify(previous.dead ?? []) === JSON.stringify(dead)) {
  console.log("No change.");
  process.exit(0);
}
fs.writeFileSync(file, JSON.stringify({ checkedAt: new Date().toISOString(), dead }, null, 2) + "\n");
console.log(`Wrote ${file}: ${dead.length} dead of ${targets.length}`);
