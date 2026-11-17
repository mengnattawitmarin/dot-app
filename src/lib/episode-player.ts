import { create } from "zustand";
import { getEpisode, saveProgress, useStories } from "@/lib/stories";
import { stopForOtherOutput } from "@/lib/player";
import { useApp } from "@/lib/store";

/**
 * Player for story / podcast episodes. Uses its own <audio> element so it never fights the
 * live-radio player; starting one stops the other. Remembers where you stopped.
 */
type EpisodeUi = { position: number; duration: number; rate: number; buffering: boolean };
export const useEpisodeUi = create<EpisodeUi>(() => ({ position: 0, duration: 0, rate: 1, buffering: false }));

const RATES = [1, 1.25, 1.5, 1.75, 2, 0.75];
let audio: HTMLAudioElement | null = null;
let currentKey: string | null = null;
let lastSaved = 0;

function element() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "auto";
  audio.setAttribute("playsinline", "true");
  audio.addEventListener("timeupdate", () => {
    const a = audio!;
    useEpisodeUi.setState({ position: a.currentTime, duration: Number.isFinite(a.duration) ? a.duration : 0 });
    if (currentKey && Math.abs(a.currentTime - lastSaved) >= 5) {
      lastSaved = a.currentTime;
      saveProgress(currentKey, a.currentTime, a.duration || 0);
    }
  });
  audio.addEventListener("loadedmetadata", () => useEpisodeUi.setState({ duration: audio!.duration || 0 }));
  audio.addEventListener("waiting", () => useEpisodeUi.setState({ buffering: true }));
  audio.addEventListener("playing", () => {
    useEpisodeUi.setState({ buffering: false });
    if (isEpisodeActive()) useApp.getState().setPlaying(true);
  });
  audio.addEventListener("pause", () => {
    if (currentKey) saveProgress(currentKey, audio!.currentTime, audio!.duration || 0);
    if (isEpisodeActive()) useApp.getState().setPlaying(false);
  });
  audio.addEventListener("ended", () => {
    if (currentKey) saveProgress(currentKey, audio!.duration || 0, audio!.duration || 0);
    if (isEpisodeActive()) useApp.getState().setPlaying(false);
  });
  audio.addEventListener("error", () => {
    if (!isEpisodeActive()) return;
    useApp.getState().setPlaying(false);
    useEpisodeUi.setState({ buffering: false });
    useApp.getState().toast("เปิดตอนนี้ไม่ได้ ลองตอนอื่น");
  });
  return audio;
}

export function isEpisodeActive() {
  return useApp.getState().now?.kind === "episode";
}

export async function playEpisode(key: string) {
  const item = getEpisode(key);
  if (!item) return;
  const a = element();
  stopForOtherOutput(); // stop live radio / studio
  const app = useApp.getState();
  app.setOutput("radio");
  app.setNow({ kind: "episode", id: key });
  app.pushRecent(key);
  a.playbackRate = useEpisodeUi.getState().rate;
  a.volume = app.muted ? 0 : app.volume;
  if (currentKey !== key) {
    currentKey = key;
    a.src = item.episode.url;
    const saved = useStories.getState().progress[key];
    const resumeAt = saved && saved.d && saved.t < saved.d - 30 ? saved.t : 0;
    lastSaved = resumeAt;
    useEpisodeUi.setState({ position: resumeAt, duration: item.episode.duration, buffering: true });
    if (resumeAt) {
      const seekOnce = () => {
        a.currentTime = resumeAt;
        a.removeEventListener("loadedmetadata", seekOnce);
      };
      a.addEventListener("loadedmetadata", seekOnce);
    }
  }
  try {
    await a.play();
  } catch (e) {
    useApp.getState().setPlaying(false);
    if (e instanceof DOMException && e.name === "NotAllowedError") useApp.getState().toast("แตะเล่นอีกครั้ง");
  }
}

export function pauseEpisode() {
  audio?.pause();
}

export async function toggleEpisode() {
  const now = useApp.getState().now;
  if (now?.kind !== "episode") return;
  if (audio && !audio.paused) pauseEpisode();
  else await playEpisode(now.id);
}

export function seekEpisode(seconds: number) {
  if (!audio) return;
  const d = audio.duration || useEpisodeUi.getState().duration;
  audio.currentTime = Math.max(0, Math.min(d ? d - 1 : seconds, seconds));
  useEpisodeUi.setState({ position: audio.currentTime });
}

export function skipEpisode(delta: number) {
  if (audio) seekEpisode(audio.currentTime + delta);
}

export function cycleRate() {
  const i = RATES.indexOf(useEpisodeUi.getState().rate);
  const rate = RATES[(i + 1) % RATES.length]!;
  useEpisodeUi.setState({ rate });
  if (audio) audio.playbackRate = rate;
}

export function setEpisodeVolume(level: number) {
  if (audio) audio.volume = level;
}

/** Called when live radio starts. */
export function stopEpisodeForRadio() {
  if (audio && !audio.paused) audio.pause();
}
