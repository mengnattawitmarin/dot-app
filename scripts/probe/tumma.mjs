// One-off probe: how does tumma.in load its audio? Writes public/probe-tumma.txt
import fs from "node:fs";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36";
const out = [];
const log = (...a) => out.push(a.join(" "));
async function get(u) {
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA }, redirect: "follow" });
    const t = await r.text();
    log(`GET ${u} -> ${r.status} ${r.headers.get("content-type")} len=${t.length}`);
    return t;
  } catch (e) {
    log(`GET ${u} FAILED ${e.message}`);
    return "";
  }
}
for (const page of ["https://tumma.in/m1039", "https://tumma.in/a2/p33"]) {
  const html = await get(page);
  log("--- head 3000 ---");
  log(html.slice(0, 3000));
  log("--- urls ---");
  for (const m of new Set(html.match(/https?:\/\/[^"'\s<>)]+/g) ?? [])) log(m);
  log("--- snippets ---");
  for (const m of html.matchAll(/.{0,160}(mp3|m4a|\.aac|audio|sound|track|play|m1039|file|media).{0,160}/gi)) log(m[0].replace(/\s+/g, " "));
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => new URL(m[1], page).href);
  for (const s of scripts.slice(0, 12)) {
    const js = await get(s);
    for (const m of js.matchAll(/.{0,200}(mp3|m4a|audio|assets\.tumma|\/m\/|media).{0,200}/gi)) log(`[${s.split("/").pop()}] ${m[0].replace(/\s+/g, " ")}`);
  }
}
// common guesses
for (const g of ["https://assets.tumma.in/m/1039.mp3", "https://assets.tumma.in/mp3/1039.mp3", "https://tumma.in/m1039.mp3", "https://tumma.in/api/m1039", "https://tumma.in/m1039.json"]) {
  try {
    const r = await fetch(g, { method: "GET", headers: { "User-Agent": UA, Range: "bytes=0-100" } });
    log(`GUESS ${g} -> ${r.status} ${r.headers.get("content-type")}`);
  } catch (e) {
    log(`GUESS ${g} fail ${e.message}`);
  }
}
fs.writeFileSync("public/probe-tumma.txt", out.join("\n").slice(0, 900000));
