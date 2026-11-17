import { getStation, getStudioByPreset, type Station } from "@/lib/catalog";
import { studio } from "@/lib/engine";
import { selectOffline, useApp } from "@/lib/store";

let audio: HTMLAudioElement | null = null;
let urls: string[] = [];
let urlIndex = 0;
let playToken = 0;
let activeStation: Station | null = null;
let hlsRadio: { destroy: () => void } | null = null;
let usingHls = false;
let failing = false;

function audibleVolume() {
  const { volume, muted } = useApp.getState();
  return muted ? 0 : volume;
}

function destroyRadioHls() {
  usingHls = false;
  hlsRadio?.destroy();
  hlsRadio = null;
}

export function bindAudio(element: HTMLAudioElement) {
  audio = element;
  element.preload = "none";
  element.setAttribute("playsinline", "true");
  if (element.dataset.bound === "1") return;
  element.dataset.bound = "1";
  element.addEventListener("playing", () => {
    if (useApp.getState().output === "radio" && activeStation?.kind === "live") {
      useApp.getState().setPlaying(true);
    }
  });
  element.addEventListener("pause", () => {
    if (activeStation?.kind === "live" && useApp.getState().output === "radio") {
      useApp.getState().setPlaying(false);
    }
  });
  element.addEventListener("error", () => {
    if (usingHls) return;
    if (element.error?.code === MediaError.MEDIA_ERR_ABORTED) return;
    void onLiveError();
  });
}

async function playUrl(element: HTMLAudioElement, src: string, token: number) {
  destroyRadioHls();
  const wantsHls = src.includes(".m3u8");
  if (wantsHls) {
    const { default: Hls } = await import("hls.js");
    if (token !== playToken) return;
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hlsRadio = hls;
      usingHls = true;
      hls.loadSource(src);
      hls.attachMedia(element);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (token !== playToken) return;
        element.volume = audibleVolume();
        element.play().then(() => {
          if (token === playToken) useApp.getState().setPlaying(true);
        }).catch((error: unknown) => {
          if (token !== playToken) return;
          useApp.getState().setPlaying(false);
          if (error instanceof DOMException && error.name === "NotAllowedError") {
            useApp.getState().toast("แตะเล่นอีกครั้งเพื่อเปิดเสียง");
          }
        });
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || token !== playToken) return;
        void onLiveError();
      });
      return;
    }
  }
  element.src = src;
  element.volume = audibleVolume();
  await element.play();
  if (token !== playToken) return;
  useApp.getState().setPlaying(true);
}

async function onLiveError() {
  if (failing) return;
  failing = true;
  try {
    const token = playToken;
    const station = activeStation;
    if (!audio || !station || station.kind !== "live") return;
    if (urlIndex < urls.length - 1) {
      urlIndex += 1;
      const next = urls[urlIndex];
      if (!next) return;
      try {
        await playUrl(audio, next, token);
      } catch {
        /* the next error event retries or falls back */
      }
      return;
    }
    if (token !== playToken) return;
    const fallback = getStudioByPreset(station.fallback);
    useApp.getState().toast(`สถานีสดไม่ตอบ — เปิด ${fallback.name}`);
    await playStation(fallback);
  } finally {
    failing = false;
  }
}

export async function playStation(station: Station) {
  if (station.kind === "live" && selectOffline(useApp.getState())) {
    const fallback = getStudioByPreset(station.fallback);
    useApp.getState().toast(`ไม่มีสัญญาณ — เปิด ${fallback.name}`);
    return playStation(fallback);
  }
  const token = ++playToken;
  activeStation = station;
  const app = useApp.getState();
  app.setOutput("radio");
  app.setNow({ kind: "station", id: station.id });
  app.pushRecent(station.id);
  applyVolume();

  if (station.kind === "studio") {
    destroyRadioHls();
    audio?.pause();
    if (studio.preset === station.preset && studio.isPaused()) {
      await studio.resume();
    } else {
      await studio.start(station.preset);
    }
    if (token !== playToken) return;
    studio.setVolume(audibleVolume());
    useApp.getState().setPlaying(true);
    return;
  }

  studio.stop();
  await studio.prepare();
  const element = audio;
  if (!element) {
    useApp.getState().toast("ตัวเล่นยังไม่พร้อม");
    return;
  }
  urls = station.urls;
  urlIndex = 0;
  const first = urls[0];
  if (!first) return;
  try {
    await playUrl(element, first, token);
  } catch (error) {
    if (token !== playToken) return;
    useApp.getState().setPlaying(false);
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      useApp.getState().toast("แตะเล่นอีกครั้งเพื่อเปิดเสียง");
    }
  }
}

export async function toggleRadio() {
  const { playing, now, output } = useApp.getState();
  if (!now || output !== "radio") {
    if (now?.kind === "station") {
      const station = getStation(now.id);
      if (station) await playStation(station);
    }
    return;
  }
  if (playing) {
    pauseRadio();
    return;
  }
  const station = activeStation ?? getStation(now.id);
  if (!station) return;
  if (station.kind === "studio" && studio.isPaused() && studio.preset === station.preset) {
    await studio.resume();
    useApp.getState().setPlaying(true);
    useApp.getState().setOutput("radio");
    return;
  }
  await playStation(station);
}

export function pauseRadio() {
  audio?.pause();
  if (studio.isRunning()) studio.pause();
  if (useApp.getState().output === "radio") useApp.getState().setPlaying(false);
}

export function stopForOtherOutput() {
  destroyRadioHls();
  audio?.pause();
  studio.stop();
  activeStation = null;
  if (useApp.getState().output === "radio") {
    useApp.getState().setPlaying(false);
  }
}

export function applyVolume() {
  const level = audibleVolume();
  if (audio) audio.volume = level;
  studio.setVolume(level);
}

export async function stepStation(direction: 1 | -1, list: Station[]) {
  if (list.length === 0) return;
  const current = useApp.getState().now?.id;
  const index = Math.max(0, list.findIndex((station) => station.id === current));
  const next = list[(index + direction + list.length) % list.length];
  if (next) await playStation(next);
}
