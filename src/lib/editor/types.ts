/** Do.T video editor — project model. Everything is plain data so undo/redo is a JSON snapshot. */

export type Aspect = "9:16" | "1:1" | "16:9" | "4:5";
export type FitMode = "fill" | "blur" | "fit";
export type FilterId = "none" | "vivid" | "warm" | "cool" | "vintage" | "bw" | "cinema" | "dream" | "drama" | "fade";
export type TransitionId = "none" | "fade" | "flash" | "zoom" | "slide";
export type TextStyle = "plain" | "outline" | "box" | "neon" | "shadow";
export type TextAnim = "none" | "fade" | "pop" | "type" | "slide" | "bounce";
export type FontId = "sans" | "display" | "serif" | "hand";

export type MediaClip = {
  id: string;
  kind: "video" | "image";
  /** object URL of the picked file */
  src: string;
  name: string;
  /** full length of the source in seconds (images: chosen display length) */
  srcDuration: number;
  /** trim in/out within the source (seconds) */
  in: number;
  out: number;
  speed: number;
  /** 0–1, this clip's original sound */
  volume: number;
  /** thumbnail data URL */
  thumb?: string;
  /** per-clip zoom punch / ken burns */
  motion?: "none" | "zoom-in" | "zoom-out" | "pan";
  /** reverse playback is not supported by <video>, so not offered */
};

export type TextItem = {
  id: string;
  text: string;
  /** centre position, 0–1 of the frame */
  x: number;
  y: number;
  /** font size as a fraction of frame height */
  size: number;
  color: string;
  style: TextStyle;
  anim: TextAnim;
  font: FontId;
  /** timeline seconds */
  start: number;
  end: number;
  /** stickers are emoji text items drawn without styling */
  sticker?: boolean;
};

export type MusicTrack = { src: string; name: string; offset: number; volume: number; fadeOut: boolean };

export type Project = {
  aspect: Aspect;
  fit: FitMode;
  clips: MediaClip[];
  texts: TextItem[];
  filter: FilterId;
  adjust: { brightness: number; contrast: number; saturation: number; temperature: number };
  transition: TransitionId;
  transitionLength: number;
  music: MusicTrack | null;
  /** master level for clips' own sound */
  origVolume: number;
  effects: { grain: boolean; letterbox: boolean; vignette: boolean; beatZoom: boolean; dateStamp: boolean };
  /** timeline seconds of musical beats (auto mode), used by beat zoom */
  beats: number[];
  watermark: boolean;
  /** frames per second for export */
  fps: number;
};

export const ASPECT_SIZE: Record<Aspect, [number, number]> = {
  "9:16": [720, 1280],
  "1:1": [960, 960],
  "16:9": [1280, 720],
  "4:5": [864, 1080],
};

export const FILTERS: Array<{ id: FilterId; label: string; css: string }> = [
  { id: "none", label: "ปกติ", css: "" },
  { id: "vivid", label: "สดใส", css: "saturate(1.45) contrast(1.08)" },
  { id: "warm", label: "อบอุ่น", css: "sepia(0.25) saturate(1.25) hue-rotate(-8deg) brightness(1.04)" },
  { id: "cool", label: "เย็นตา", css: "saturate(1.1) hue-rotate(12deg) brightness(1.02) contrast(1.05)" },
  { id: "vintage", label: "วินเทจ", css: "sepia(0.55) contrast(0.92) saturate(0.85) brightness(1.05)" },
  { id: "bw", label: "ขาวดำ", css: "grayscale(1) contrast(1.15)" },
  { id: "cinema", label: "ภาพยนตร์", css: "contrast(1.18) saturate(0.82) brightness(0.95)" },
  { id: "dream", label: "ฝัน", css: "saturate(1.2) brightness(1.1) contrast(0.9) blur(0.4px)" },
  { id: "drama", label: "ดราม่า", css: "contrast(1.35) saturate(0.7) brightness(0.9)" },
  { id: "fade", label: "ซีดจาง", css: "contrast(0.82) brightness(1.08) saturate(0.8)" },
];

export const STICKERS = ["🔥", "😂", "😍", "🥹", "✨", "💖", "👍", "🎉", "😱", "🤣", "😎", "🙏", "💯", "⭐", "🌈", "🍜", "🏝️", "🎵", "📍", "👀", "💥", "🫶", "😴", "🤯"];

export const TEXT_COLORS = ["#ffffff", "#f2d38f", "#ffdd00", "#ff5c5c", "#4ade80", "#38bdf8", "#c084fc", "#111111"];

export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyProject(): Project {
  return {
    aspect: "9:16",
    fit: "blur",
    clips: [],
    texts: [],
    filter: "none",
    adjust: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 },
    transition: "fade",
    transitionLength: 0.35,
    music: null,
    origVolume: 1,
    effects: { grain: false, letterbox: false, vignette: false, beatZoom: false, dateStamp: false },
    beats: [],
    watermark: true,
    fps: 30,
  };
}

/** Timeline seconds a clip occupies. */
export const clipLength = (c: MediaClip) => Math.max(0.1, (c.out - c.in) / c.speed);

export function timeline(p: Project) {
  let t = 0;
  return p.clips.map((clip) => {
    const seg = { clip, start: t, length: clipLength(clip) };
    t += seg.length;
    return seg;
  });
}

export const projectDuration = (p: Project) => p.clips.reduce((sum, c) => sum + clipLength(c), 0);
