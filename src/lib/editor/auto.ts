import { clipFromFile } from "@/lib/editor/engine";
import { emptyProject, uid, type FilterId, type MediaClip, type Project, type TextItem, type TransitionId } from "@/lib/editor/types";

/**
 * Auto mode: pick the liveliest moment of each clip, cut on the beat of the music,
 * and dress it with a template (filter, transition, effects, title).
 */
export type TemplateId = "beat" | "chill" | "cinema" | "vlog" | "retro";

export const TEMPLATES: Array<{
  id: TemplateId;
  label: string;
  desc: string;
  emoji: string;
  bpm: number;
  beatsPerCut: number;
  filter: FilterId;
  transition: TransitionId;
  effects: Partial<Project["effects"]>;
  titleStyle: Pick<TextItem, "style" | "anim" | "font" | "color" | "size" | "y">;
}> = [
  {
    id: "beat",
    label: "บีทมันส์",
    desc: "ตัดเร็วตามจังหวะ ซูมกระแทก",
    emoji: "⚡",
    bpm: 120,
    beatsPerCut: 2,
    filter: "vivid",
    transition: "flash",
    effects: { beatZoom: true },
    titleStyle: { style: "outline", anim: "pop", font: "display", color: "#ffdd00", size: 0.075, y: 0.45 },
  },
  {
    id: "chill",
    label: "ชิล ๆ",
    desc: "จังหวะช้า โทนอุ่น เฟดนุ่ม",
    emoji: "🌿",
    bpm: 80,
    beatsPerCut: 4,
    filter: "warm",
    transition: "fade",
    effects: { vignette: true },
    titleStyle: { style: "shadow", anim: "fade", font: "sans", color: "#ffffff", size: 0.055, y: 0.8 },
  },
  {
    id: "cinema",
    label: "ภาพยนตร์",
    desc: "แถบดำ โทนหนัง ไตเติลกลางจอ",
    emoji: "🎬",
    bpm: 90,
    beatsPerCut: 4,
    filter: "cinema",
    transition: "fade",
    effects: { letterbox: true, vignette: true, grain: true },
    titleStyle: { style: "plain", anim: "fade", font: "serif", color: "#f2d38f", size: 0.06, y: 0.5 },
  },
  {
    id: "vlog",
    label: "วล็อกเที่ยว",
    desc: "สีสด สไลด์ไว ใส่วันที่",
    emoji: "🏝️",
    bpm: 110,
    beatsPerCut: 4,
    filter: "vivid",
    transition: "slide",
    effects: { dateStamp: true },
    titleStyle: { style: "box", anim: "slide", font: "display", color: "#ffffff", size: 0.06, y: 0.15 },
  },
  {
    id: "retro",
    label: "ย้อนวัย",
    desc: "ฟิล์มเก่า เกรน วันที่สีส้ม",
    emoji: "📼",
    bpm: 95,
    beatsPerCut: 4,
    filter: "vintage",
    transition: "zoom",
    effects: { grain: true, dateStamp: true, vignette: true },
    titleStyle: { style: "neon", anim: "type", font: "hand", color: "#ff9a3c", size: 0.06, y: 0.82 },
  },
];

/** Beat times (seconds) + tempo, from the energy envelope of the music. */
export async function detectBeats(file: Blob): Promise<{ bpm: number; beats: number[] }> {
  const buf = await file.arrayBuffer();
  const Ctx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new Ctx(1, 44100, 44100);
  const audio = await ctx.decodeAudioData(buf);
  const data = audio.getChannelData(0);
  const rate = audio.sampleRate;
  const hop = 1024;
  const energy: number[] = [];
  for (let i = 0; i + hop < data.length && energy.length < (rate * 180) / hop; i += hop) {
    let e = 0;
    for (let j = i; j < i + hop; j++) e += data[j]! * data[j]!;
    energy.push(e / hop);
  }
  // onset = energy rise above local average
  const win = 43; // ~1 s
  const beats: number[] = [];
  let last = -1;
  for (let i = win; i < energy.length - 1; i++) {
    let avg = 0;
    for (let j = i - win; j < i; j++) avg += energy[j]!;
    avg /= win;
    const e = energy[i]!;
    if (e > avg * 1.45 && e >= energy[i - 1]! && e >= energy[i + 1]!) {
      const t = (i * hop) / rate;
      if (t - last > 0.28) {
        beats.push(t);
        last = t;
      }
    }
  }
  // tempo from the most common interval between onsets
  const hist = new Map<number, number>();
  for (let i = 1; i < beats.length; i++) {
    let d = beats[i]! - beats[i - 1]!;
    while (d < 0.4) d *= 2;
    while (d > 1) d /= 2;
    const bpm = Math.round(60 / d);
    hist.set(bpm, (hist.get(bpm) ?? 0) + 1);
  }
  const bpm = [...hist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 100;
  return { bpm, beats };
}

/** Start time of the most "eventful" window of a video (largest frame-to-frame change). */
export async function bestMoment(clip: MediaClip, windowLen: number): Promise<number> {
  if (clip.kind !== "video" || clip.srcDuration <= windowLen + 0.5) return 0;
  const v = document.createElement("video");
  v.src = clip.src;
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  await new Promise<void>((ok) => {
    if (v.readyState >= 1) return ok();
    v.addEventListener("loadedmetadata", () => ok(), { once: true });
    window.setTimeout(ok, 4000);
  });
  const c = document.createElement("canvas");
  c.width = 48;
  c.height = 27;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return 0;
  const samples = Math.min(16, Math.max(6, Math.floor(clip.srcDuration / 1.5)));
  const span = clip.srcDuration - 0.3;
  let prev: Uint8ClampedArray | null = null;
  const scores: Array<{ t: number; s: number }> = [];
  for (let i = 0; i < samples; i++) {
    const t = 0.15 + (span * i) / (samples - 1);
    await new Promise<void>((ok) => {
      v.addEventListener("seeked", () => ok(), { once: true });
      v.currentTime = t;
      window.setTimeout(ok, 1200);
    });
    g.drawImage(v, 0, 0, c.width, c.height);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    let diff = 0;
    let bright = 0;
    for (let j = 0; j < px.length; j += 4) {
      bright += px[j]! + px[j + 1]! + px[j + 2]!;
      if (prev) diff += Math.abs(px[j]! - prev[j]!) + Math.abs(px[j + 1]! - prev[j + 1]!) + Math.abs(px[j + 2]! - prev[j + 2]!);
    }
    // penalise near-black frames (lens covered, fades)
    const tooDark = bright / (px.length / 4) / 3 < 25;
    scores.push({ t, s: tooDark ? 0 : diff });
    prev = px;
  }
  v.removeAttribute("src");
  v.load();
  const best = scores.reduce((a, b) => (b.s > a.s ? b : a), scores[0]!);
  return Math.max(0, Math.min(clip.srcDuration - windowLen, best.t - windowLen / 2));
}

export type AutoInput = {
  files: File[];
  template: TemplateId;
  music?: File | null;
  title?: string;
  /** target total length in seconds (0 = use everything once) */
  target?: number;
  onProgress?: (label: string, p: number) => void;
};

export async function buildAutoProject(input: AutoInput): Promise<Project> {
  const tpl = TEMPLATES.find((t) => t.id === input.template) ?? TEMPLATES[0]!;
  const p = emptyProject();
  p.filter = tpl.filter;
  p.transition = tpl.transition;
  p.effects = { ...p.effects, ...tpl.effects };

  input.onProgress?.("กำลังโหลดคลิป", 0.05);
  const clips: MediaClip[] = [];
  for (const [i, f] of input.files.entries()) {
    clips.push(await clipFromFile(f));
    input.onProgress?.("กำลังโหลดคลิป", 0.05 + (0.25 * (i + 1)) / input.files.length);
  }

  let bpm = tpl.bpm;
  let musicBeats: number[] = [];
  if (input.music) {
    input.onProgress?.("กำลังฟังจังหวะเพลง", 0.35);
    try {
      const r = await detectBeats(input.music);
      bpm = r.bpm;
      musicBeats = r.beats;
    } catch {
      /* fall back to template tempo */
    }
    p.music = { src: URL.createObjectURL(input.music), name: input.music.name, offset: Math.max(0, (musicBeats[0] ?? 0) - 0.05), volume: 0.85, fadeOut: true };
  }
  const beat = 60 / bpm;
  // cut length: N beats, kept between 0.8 s and 4 s
  let cut = beat * tpl.beatsPerCut;
  while (cut < 0.8) cut *= 2;
  while (cut > 4) cut /= 2;

  // spread the target length over the clips; photos get one cut, videos up to 3 cuts
  const target = input.target || Math.min(60, Math.max(8, clips.length * cut * 1.5));
  const perClip = Math.max(cut, Math.round(target / clips.length / cut) * cut);

  const out: MediaClip[] = [];
  for (const [i, c] of clips.entries()) {
    input.onProgress?.("กำลังหาช่วงที่น่าสนใจ", 0.4 + (0.55 * i) / clips.length);
    if (c.kind === "image") {
      out.push({ ...c, srcDuration: cut, in: 0, out: cut, motion: i % 2 ? "zoom-out" : "zoom-in" });
      continue;
    }
    const len = Math.min(perClip, c.srcDuration);
    const start = await bestMoment(c, len);
    out.push({ ...c, in: start, out: start + len, volume: input.music ? 0.15 : 1 });
  }
  p.clips = out;

  // beat grid for beat-zoom, aligned to the timeline
  const total = out.reduce((s, c) => s + (c.out - c.in) / c.speed, 0);
  p.beats = musicBeats.length
    ? musicBeats.map((b) => b - (p.music?.offset ?? 0)).filter((b) => b >= 0 && b <= total)
    : Array.from({ length: Math.floor(total / beat) }, (_, k) => k * beat);

  if (input.title?.trim()) {
    p.texts.push({
      id: uid(),
      text: input.title.trim(),
      x: 0.5,
      ...tpl.titleStyle,
      start: 0,
      end: Math.min(total, Math.max(2.5, cut * 2)),
    });
  }
  input.onProgress?.("เสร็จแล้ว", 1);
  return p;
}
