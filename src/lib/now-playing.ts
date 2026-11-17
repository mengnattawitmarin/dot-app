import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { getStation, mark, stationFreq, stationQueue, type Station } from "@/lib/catalog";
import { currentStreamUrl, pauseRadio, stepStation, toggleRadio } from "@/lib/player";
import { selectOffline, useApp } from "@/lib/store";
import { hashPalette, STUDIO_PALETTE } from "@/components/art";

/**
 * Lock-screen / notification player on Android (native MediaPlaybackService, see native/android).
 * iOS and the web use the Media Session API in media-session.ts instead.
 */
type NowPlayingPlugin = {
  update(options: { title: string; artist: string; playing: boolean; artwork?: string }): Promise<void>;
  clear(): Promise<void>;
  watchMetadata(options: { url: string }): Promise<void>;
  stopMetadata(): Promise<void>;
  addListener(event: "action", cb: (e: { action: "play" | "pause" | "next" | "prev" }) => void): Promise<PluginListenerHandle>;
  addListener(event: "metadata", cb: (e: { url: string; title: string }) => void): Promise<PluginListenerHandle>;
};

/** Split "Artist - Title" for display; falls back to the whole string as the title. */
export function splitSong(raw: string | null): { title: string; artist: string } | null {
  if (!raw) return null;
  const i = raw.indexOf(" - ");
  if (i > 0 && i < raw.length - 3) return { artist: raw.slice(0, i).trim(), title: raw.slice(i + 3).trim() };
  return { title: raw.trim(), artist: "" };
}

const NowPlaying = registerPlugin<NowPlayingPlugin>("NowPlaying");
const enabled = Capacitor.getPlatform() === "android";

/** Draw the station artwork (same look as StationArt) into a PNG for the lock screen. */
export function renderArtwork(station: Station): string {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const [light, mid, dark] = station.kind === "studio" ? STUDIO_PALETTE[station.preset] : hashPalette(station.id);

  const bg = ctx.createRadialGradient(size * 0.2, size * 0.1, 0, size * 0.2, size * 0.1, size * 1.2);
  bg.addColorStop(0, mid);
  bg.addColorStop(0.75, dark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // radio waves from the bottom-right corner
  ctx.lineWidth = 12;
  [110, 190, 270, 350].forEach((r, i) => {
    ctx.strokeStyle = light;
    ctx.globalAlpha = 0.28 - i * 0.05;
    ctx.beginPath();
    ctx.arc(size * 0.92, size * 0.92, r, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = light;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const freq = stationFreq(station);
  const font = (px: number, weight = 700) => `${weight} ${px}px Prompt, "Noto Sans Thai", sans-serif`;
  if (freq) {
    const [whole, dec] = freq.split(".");
    const big = (whole ?? "").length > 2 ? 165 : 200;
    ctx.font = font(big);
    const w = ctx.measureText(whole ?? "").width;
    ctx.font = font(110);
    const d = dec ? ctx.measureText(`.${dec}`).width : 0;
    const x0 = size / 2 - (w + d) / 2;
    ctx.textAlign = "left";
    ctx.font = font(big);
    ctx.fillText(whole ?? "", x0, size * 0.44);
    if (dec) {
      ctx.font = font(110);
      ctx.fillText(`.${dec}`, x0 + w, size * 0.49);
    }
    ctx.textAlign = "center";
    ctx.font = font(52, 600);
    ctx.fillText("F M", size / 2, size * 0.68);
  } else {
    ctx.font = font(station.kind === "studio" ? 150 : 190);
    ctx.fillText(station.kind === "studio" ? "♪" : mark(station.name), size / 2, size * 0.46);
  }
  ctx.font = font(40, 600);
  ctx.globalAlpha = 0.85;
  ctx.fillText("Do.T", size / 2, size * 0.88);
  ctx.globalAlpha = 1;

  return canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "";
}

export function setupNowPlaying() {
  if (!enabled) return;
  const queue = () => stationQueue(selectOffline(useApp.getState()));

  void NowPlaying.addListener("action", ({ action }) => {
    const s = useApp.getState();
    if (action === "play") {
      if (!(s.playing && s.output === "radio")) void toggleRadio();
    } else if (action === "pause") {
      pauseRadio();
    } else if (action === "next") {
      void stepStation(1, queue());
    } else if (action === "prev") {
      void stepStation(-1, queue());
    }
  });

  // ---- song titles from the stream ----
  let watchedUrl: string | null = null;
  void NowPlaying.addListener("metadata", ({ url, title }) => {
    if (url === watchedUrl) useApp.getState().setSongTitle(title);
  });
  const syncMetadata = () => {
    const s = useApp.getState();
    const url = s.playing && s.output === "radio" ? currentStreamUrl() : null;
    if (url === watchedUrl) return;
    watchedUrl = url;
    if (url) void NowPlaying.watchMetadata({ url }).catch(() => undefined);
    else void NowPlaying.stopMetadata().catch(() => undefined);
  };

  let lastId: string | null = null;
  let lastPlaying: boolean | null = null;
  let lastSong: string | null = null;
  let artwork = "";

  const sync = () => {
    const s = useApp.getState();
    const station = s.now ? getStation(s.now.id) : undefined;
    const playing = s.playing && s.output === "radio";
    if (!station || s.output === "tv" || s.output === "video") {
      if (lastId !== null) void NowPlaying.clear().catch(() => undefined);
      lastId = null;
      lastPlaying = null;
      return;
    }
    if (station.id === lastId && playing === lastPlaying && s.songTitle === lastSong) return;
    const changed = station.id !== lastId;
    if (changed) artwork = renderArtwork(station);
    lastId = station.id;
    lastPlaying = playing;
    lastSong = s.songTitle;
    const song = splitSong(s.songTitle);
    void NowPlaying.update({
      title: song ? song.title : station.name,
      artist: song ? [song.artist, station.name].filter(Boolean).join(" · ") : station.kind === "live" ? `${station.city} · สด` : "สตูดิโอในเครื่อง",
      playing,
      artwork: changed ? artwork : undefined,
    }).catch(() => {
      // Service couldn't start (e.g. app in background) — try again on the next change.
      lastId = null;
    });
  };

  useApp.subscribe(() => {
    syncMetadata();
    sync();
  });
  sync();
}
