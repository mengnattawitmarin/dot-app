// One-off probe: tumma.in playlist API. Writes public/probe-tumma.txt
import fs from "node:fs";
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36";
const out = [];
const log = (...a) => out.push(a.join(" "));
async function call(u, method = "GET") {
  try {
    const r = await fetch(u, {
      method,
      headers: { "User-Agent": UA, "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/javascript, */*", Referer: "https://tumma.in/a2/p33" },
      body: method === "POST" ? "" : undefined,
    });
    const t = await r.text();
    log(`${method} ${u} -> ${r.status} ${r.headers.get("content-type")} len=${t.length}`);
    log(t.slice(0, 2500));
    return t;
  } catch (e) {
    log(`${method} ${u} FAILED ${e.message}`);
    return "";
  }
}
for (const u of ["https://tumma.in/api/media/linkedPlaylist/33", "https://tumma.in/api/media/linkedPlaylistFromMedia/1039"]) {
  const t = await call(u, "GET");
  if (!t.includes("soundUrl")) await call(u, "POST");
}
const page = await (await fetch("https://assets.tumma.in/js/player.js", { headers: { "User-Agent": UA } })).text();
const i = page.indexOf("linkedPlaylist/");
log("--- player.js around linkedPlaylist ---");
log(page.slice(Math.max(0, i - 1500), i + 1500));
const all = out.join("\n");
const sound = all.match(/"soundUrl"\s*:\s*"([^"]+)"/);
if (sound) {
  const url = sound[1].replace(/\\\//g, "/");
  log(`--- soundUrl sample ${url}`);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Range: "bytes=0-1000", Origin: "https://mengnattawitmarin.github.io" } });
    log(`sound -> ${r.status} type=${r.headers.get("content-type")} acao=${r.headers.get("access-control-allow-origin")} range=${r.headers.get("content-range")} len=${r.headers.get("content-length")}`);
  } catch (e) {
    log(`sound fail ${e.message}`);
  }
}
fs.writeFileSync("public/probe-tumma.txt", out.join("\n").slice(0, 400000));
