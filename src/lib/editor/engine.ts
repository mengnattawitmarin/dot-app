import {
  ASPECT_SIZE,
  FILTERS,
  projectDuration,
  timeline,
  type FontId,
  type MediaClip,
  type Project,
  type TextItem,
} from "@/lib/editor/types";

/**
 * Canvas compositor for the editor. Preview and export share the same draw path:
 * export = play the timeline in real time while MediaRecorder captures canvas + mixed audio.
 * Runs fully on-device (no upload, no ffmpeg) — works in Android WebView / WKWebView.
 */
type Media = HTMLVideoElement | HTMLImageElement;

const FONT: Record<FontId, string> = {
  sans: 'Prompt, "Noto Sans Thai", sans-serif',
  display: '"Prompt", "Noto Sans Thai", sans-serif',
  serif: '"Noto Serif Thai", Georgia, serif',
  hand: '"Mali", "Itim", "Comic Sans MS", cursive',
};

export class EditorEngine {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private project: Project;
  private media = new Map<string, Media>();
  private audio: AudioContext | null = null;
  private master: GainNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private clipGains = new Map<string, GainNode>();
  private musicEl: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
  private musicSrc = "";
  private grain: HTMLCanvasElement | null = null;

  playing = false;
  time = 0;
  private raf = 0;
  private wallStart = 0;
  private timeStart = 0;
  private activeIndex = -1;
  onTime: (t: number) => void = () => {};
  onPlayState: (playing: boolean) => void = () => {};
  private onEnded: (() => void) | null = null;

  constructor(project: Project) {
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas not supported");
    this.ctx = ctx;
    this.project = project;
    this.resize();
  }

  /* ---------------- project & media ---------------- */

  async setProject(p: Project) {
    const aspectChanged = p.aspect !== this.project.aspect;
    this.project = p;
    if (aspectChanged) this.resize();
    await Promise.all(p.clips.map((c) => this.ensureMedia(c)));
    // free media of removed clips
    const ids = new Set(p.clips.map((c) => c.src));
    for (const [src, el] of this.media) {
      if (!ids.has(src)) {
        if (el instanceof HTMLVideoElement) el.pause();
        this.media.delete(src);
      }
    }
    this.syncMusic();
    this.applyGains();
    if (this.time > this.duration()) this.time = Math.max(0, this.duration() - 0.05);
    if (!this.playing) await this.seek(this.time);
  }

  private resize() {
    const [w, h] = ASPECT_SIZE[this.project.aspect];
    this.canvas.width = w;
    this.canvas.height = h;
  }

  duration() {
    return projectDuration(this.project);
  }

  private async ensureMedia(c: MediaClip) {
    if (this.media.has(c.src)) return;
    if (c.kind === "image") {
      const img = new Image();
      img.decoding = "async";
      img.src = c.src;
      this.media.set(c.src, img);
      await img.decode().catch(() => undefined);
      return;
    }
    const v = document.createElement("video");
    v.src = c.src;
    v.playsInline = true;
    v.preload = "auto";
    v.crossOrigin = "anonymous";
    v.setAttribute("playsinline", "true");
    this.media.set(c.src, v);
    await new Promise<void>((ok) => {
      if (v.readyState >= 1) return ok();
      v.addEventListener("loadedmetadata", () => ok(), { once: true });
      v.addEventListener("error", () => ok(), { once: true });
    });
    if (this.audio) this.routeVideo(v, c);
  }

  private ensureAudio() {
    if (this.audio) {
      if (this.audio.state === "suspended") void this.audio.resume();
      return;
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audio = new Ctx();
    this.master = this.audio.createGain();
    this.master.connect(this.audio.destination);
    this.recordDest = this.audio.createMediaStreamDestination();
    this.master.connect(this.recordDest);
    for (const c of this.project.clips) {
      const el = this.media.get(c.src);
      if (el instanceof HTMLVideoElement) this.routeVideo(el, c);
    }
    this.syncMusic();
  }

  private routed = new WeakSet<HTMLMediaElement>();

  private routeVideo(v: HTMLVideoElement, c: MediaClip) {
    if (!this.audio || !this.master || this.routed.has(v)) return;
    try {
      const src = this.audio.createMediaElementSource(v);
      const g = this.audio.createGain();
      src.connect(g).connect(this.master);
      this.clipGains.set(c.src, g);
      this.routed.add(v);
    } catch {
      /* element already routed */
    }
    this.applyGains();
  }

  private syncMusic() {
    const m = this.project.music;
    if (!m) {
      this.musicEl?.pause();
      return;
    }
    if (!this.musicEl || this.musicSrc !== m.src) {
      this.musicEl?.pause();
      this.musicEl = new Audio(m.src);
      this.musicEl.preload = "auto";
      this.musicSrc = m.src;
      this.musicGain = null;
    }
    if (this.audio && this.master && !this.musicGain && this.musicEl && !this.routed.has(this.musicEl)) {
      const src = this.audio.createMediaElementSource(this.musicEl);
      this.musicGain = this.audio.createGain();
      src.connect(this.musicGain).connect(this.master);
      this.routed.add(this.musicEl);
    }
    this.applyGains();
  }

  private applyGains() {
    for (const c of this.project.clips) {
      const g = this.clipGains.get(c.src);
      if (g) g.gain.value = c.volume * this.project.origVolume;
    }
    if (this.musicGain && this.project.music) this.musicGain.gain.value = this.project.music.volume;
  }

  /* ---------------- transport ---------------- */

  private segmentAt(t: number) {
    const segs = timeline(this.project);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]!;
      if (t < s.start + s.length || i === segs.length - 1) return { i, seg: s, local: Math.max(0, t - s.start), segs };
    }
    return null;
  }

  async seek(t: number) {
    this.time = Math.max(0, Math.min(t, Math.max(0, this.duration() - 0.001)));
    const hit = this.segmentAt(this.time);
    if (!hit) {
      this.drawEmpty();
      this.onTime(this.time);
      return;
    }
    const el = this.media.get(hit.seg.clip.src);
    if (el instanceof HTMLVideoElement) {
      const target = hit.seg.clip.in + hit.local * hit.seg.clip.speed;
      if (Math.abs(el.currentTime - target) > 0.04) {
        await new Promise<void>((ok) => {
          const done = () => ok();
          el.addEventListener("seeked", done, { once: true });
          el.currentTime = target;
          window.setTimeout(done, 600);
        });
      }
    }
    this.draw(this.time);
    this.onTime(this.time);
  }

  play(fromStart = false) {
    if (this.playing || this.project.clips.length === 0) return;
    this.ensureAudio();
    if (fromStart || this.time >= this.duration() - 0.05) this.time = 0;
    this.playing = true;
    this.wallStart = performance.now();
    this.timeStart = this.time;
    this.activeIndex = -1;
    this.startMusic(this.time);
    this.onPlayState(true);
    const loop = () => {
      if (!this.playing) return;
      const t = this.timeStart + (performance.now() - this.wallStart) / 1000;
      if (t >= this.duration()) {
        this.time = this.duration();
        this.draw(this.time - 0.001);
        this.stop();
        this.onEnded?.();
        return;
      }
      this.time = t;
      this.advance(t);
      const m = this.project.music;
      if (m && this.musicGain) {
        const fade = m.fadeOut ? Math.min(1, (this.duration() - t) / 2) : 1;
        this.musicGain.gain.value = m.volume * Math.max(0, fade);
      }
      this.draw(t);
      this.onTime(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Make sure the clip under the playhead is the one playing. */
  private advance(t: number) {
    const hit = this.segmentAt(t);
    if (!hit || hit.i === this.activeIndex) return;
    const prev = hit.segs[this.activeIndex];
    if (prev) {
      const pe = this.media.get(prev.clip.src);
      if (pe instanceof HTMLVideoElement && prev.clip.src !== hit.seg.clip.src) pe.pause();
    }
    this.activeIndex = hit.i;
    const el = this.media.get(hit.seg.clip.src);
    if (el instanceof HTMLVideoElement) {
      el.playbackRate = hit.seg.clip.speed;
      el.currentTime = hit.seg.clip.in + hit.local * hit.seg.clip.speed;
      void el.play().catch(() => undefined);
    }
  }

  private startMusic(t: number) {
    const m = this.project.music;
    if (!m || !this.musicEl) return;
    this.musicEl.currentTime = m.offset + t;
    void this.musicEl.play().catch(() => undefined);
  }

  pause() {
    this.stop();
  }

  private stop() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    for (const el of this.media.values()) if (el instanceof HTMLVideoElement) el.pause();
    this.musicEl?.pause();
    this.onPlayState(false);
  }

  destroy() {
    this.stop();
    void this.audio?.close();
    this.media.clear();
  }

  /* ---------------- drawing ---------------- */

  private drawEmpty() {
    const { ctx, canvas } = this;
    ctx.fillStyle = "#0b0a08";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private cssFilter() {
    const p = this.project;
    const base = FILTERS.find((f) => f.id === p.filter)?.css ?? "";
    const a = p.adjust;
    const parts = [base];
    if (a.brightness) parts.push(`brightness(${1 + a.brightness / 100})`);
    if (a.contrast) parts.push(`contrast(${1 + a.contrast / 100})`);
    if (a.saturation) parts.push(`saturate(${1 + a.saturation / 100})`);
    if (a.temperature > 0) parts.push(`sepia(${a.temperature / 250})`);
    if (a.temperature < 0) parts.push(`hue-rotate(${a.temperature / 6}deg)`);
    return parts.filter(Boolean).join(" ") || "none";
  }

  private drawMedia(el: Media, scale: number, offsetX = 0, filter = "none") {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const sw = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
    const sh = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
    if (!sw || !sh) return;
    const cover = Math.max(W / sw, H / sh);
    const contain = Math.min(W / sw, H / sh);
    const fit = this.project.fit;
    ctx.save();
    if (fit === "blur" && Math.abs(sw / sh - W / H) > 0.02) {
      ctx.filter = `blur(28px) brightness(0.7) ${filter === "none" ? "" : filter}`.trim();
      const s = cover * 1.1;
      ctx.drawImage(el, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
    } else if (fit === "fit") {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    }
    ctx.filter = filter;
    const s = (fit === "fill" ? cover : contain) * scale;
    ctx.drawImage(el, (W - sw * s) / 2 + offsetX, (H - sh * s) / 2, sw * s, sh * s);
    ctx.restore();
  }

  draw(t: number) {
    const { ctx, canvas, project: p } = this;
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const hit = this.segmentAt(t);
    if (!hit) return this.drawEmpty();
    const { seg, local, i, segs } = hit;
    const el = this.media.get(seg.clip.src);
    const filter = this.cssFilter();
    const tl = p.transitionLength;
    const toEnd = seg.length - local;
    const progress = seg.length ? local / seg.length : 0;

    // motion: ken burns for photos, optional per-clip zoom, beat zoom punches
    let scale = 1;
    const motion = seg.clip.motion ?? (seg.clip.kind === "image" ? "zoom-in" : "none");
    if (motion === "zoom-in") scale *= 1 + 0.1 * progress;
    if (motion === "zoom-out") scale *= 1.1 - 0.1 * progress;
    let offsetX = motion === "pan" ? (progress - 0.5) * W * 0.08 : 0;
    if (p.effects.beatZoom && p.beats.length) {
      const near = p.beats.reduce((m, b) => Math.min(m, Math.abs(b - t)), Infinity);
      if (near < 0.12) scale *= 1 + 0.06 * (1 - near / 0.12);
    }
    // transitions in/out
    let alpha = 1;
    let flash = 0;
    if (p.transition !== "none") {
      const inP = i > 0 && local < tl ? local / tl : 1;
      const outP = i < segs.length - 1 && toEnd < tl ? toEnd / tl : 1;
      const k = Math.min(inP, outP);
      if (p.transition === "fade") alpha = k;
      if (p.transition === "flash") flash = 1 - k;
      if (p.transition === "zoom") scale *= 1 + (1 - k) * 0.25;
      if (p.transition === "slide" && inP < 1) offsetX += (1 - inP) * W;
    }

    if (el) {
      ctx.globalAlpha = alpha;
      this.drawMedia(el, scale, offsetX, filter);
      ctx.globalAlpha = 1;
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.9})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (p.effects.vignette) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (p.effects.grain) this.drawGrain();
    if (p.effects.letterbox) {
      const bar = Math.round(H * (W > H ? 0.09 : 0.11));
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, bar);
      ctx.fillRect(0, H - bar, W, bar);
    }
    if (p.effects.dateStamp) {
      const d = new Date();
      const stamp = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
      ctx.save();
      ctx.font = `600 ${Math.round(H * 0.032)}px "Courier New", monospace`;
      ctx.fillStyle = "#ff9a3c";
      ctx.shadowColor = "rgba(255,120,0,0.8)";
      ctx.shadowBlur = 8;
      ctx.textAlign = "right";
      ctx.fillText(stamp, W - W * 0.06, H - H * (p.effects.letterbox ? 0.14 : 0.06));
      ctx.restore();
    }
    for (const item of p.texts) if (t >= item.start && t <= item.end) this.drawText(item, t);
    if (p.watermark) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.font = `700 ${Math.round(H * 0.024)}px ${FONT.sans}`;
      ctx.fillStyle = "#f2d38f";
      ctx.textAlign = "right";
      ctx.fillText("Do.T", W - W * 0.04, H * 0.045);
      ctx.restore();
    }
  }

  private drawGrain() {
    const { ctx, canvas } = this;
    if (!this.grain) {
      this.grain = document.createElement("canvas");
      this.grain.width = this.grain.height = 256;
      const g = this.grain.getContext("2d")!;
      const img = g.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 28;
      }
      g.putImageData(img, 0, 0);
    }
    const ox = Math.random() * 256;
    const oy = Math.random() * 256;
    ctx.save();
    ctx.translate(-ox, -oy);
    ctx.fillStyle = ctx.createPattern(this.grain, "repeat")!;
    ctx.fillRect(0, 0, canvas.width + 256, canvas.height + 256);
    ctx.restore();
  }

  /** Bounding box (canvas px) of a text item — used for hit-testing drags. */
  textBox(item: TextItem) {
    const H = this.canvas.height;
    const W = this.canvas.width;
    const px = item.size * H;
    this.ctx.font = `700 ${px}px ${FONT[item.font]}`;
    const lines = item.text.split("\n");
    const w = Math.max(...lines.map((l) => this.ctx.measureText(l).width), px);
    const h = lines.length * px * 1.25;
    return { x: item.x * W - w / 2, y: item.y * H - h / 2, w, h };
  }

  private drawText(item: TextItem, t: number) {
    const { ctx, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const age = t - item.start;
    const left = item.end - t;
    let alpha = 1;
    let scale = 1;
    let dy = 0;
    let text = item.text;
    if (item.anim === "fade") alpha = Math.min(1, age / 0.35, left / 0.35);
    if (item.anim === "pop") {
      const k = Math.min(1, age / 0.3);
      scale = k < 1 ? 0.5 + 0.6 * k - 0.1 * Math.sin(k * Math.PI) : 1;
      alpha = Math.min(1, left / 0.25);
    }
    if (item.anim === "slide") {
      const k = Math.min(1, age / 0.35);
      dy = (1 - k) * H * 0.06;
      alpha = Math.min(k, left / 0.25, 1);
    }
    if (item.anim === "bounce") dy = -Math.abs(Math.sin(age * 4)) * H * 0.012;
    if (item.anim === "type") text = item.text.slice(0, Math.ceil(item.text.length * Math.min(1, age / Math.max(0.6, item.text.length * 0.06))));
    if (alpha <= 0) return;

    const px = item.size * H;
    const x = item.x * W;
    const y = item.y * H + dy;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${item.sticker ? 400 : 700} ${px}px ${item.sticker ? "sans-serif" : FONT[item.font]}`;
    const lines = text.split("\n");
    const lh = px * 1.25;
    const top = -((lines.length - 1) * lh) / 2;
    if (!item.sticker && item.style === "box") {
      const full = this.textBox(item);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const pad = px * 0.35;
      roundRect(ctx, -full.w / 2 - pad, top - lh / 2 - pad * 0.4, full.w + pad * 2, lines.length * lh + pad * 0.8, px * 0.3);
      ctx.fill();
    }
    lines.forEach((line, n) => {
      const ly = top + n * lh;
      if (!item.sticker) {
        if (item.style === "outline") {
          ctx.lineWidth = px * 0.14;
          ctx.strokeStyle = item.color === "#111111" ? "#ffffff" : "#000000";
          ctx.lineJoin = "round";
          ctx.strokeText(line, 0, ly);
        }
        if (item.style === "neon") {
          ctx.shadowColor = item.color;
          ctx.shadowBlur = px * 0.6;
        }
        if (item.style === "shadow") {
          ctx.shadowColor = "rgba(0,0,0,0.75)";
          ctx.shadowBlur = px * 0.25;
          ctx.shadowOffsetY = px * 0.08;
        }
      }
      ctx.fillStyle = item.color;
      ctx.fillText(line, 0, ly);
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    });
    ctx.restore();
  }

  /* ---------------- export ---------------- */

  static pickMime() {
    const candidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1,mp4a",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    return candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
  }

  /**
   * Record the whole timeline in real time. Resolves with the finished video.
   * Keep the screen on and the app in front while this runs.
   */
  async export(onProgress: (p: number) => void, signal?: AbortSignal): Promise<{ blob: Blob; mime: string }> {
    if (typeof MediaRecorder === "undefined") throw new Error("เครื่องนี้ไม่รองรับการบันทึกวิดีโอ");
    this.ensureAudio();
    if (this.audio?.state === "suspended") await this.audio.resume();
    this.stop();
    await this.seek(0);
    const mime = EditorEngine.pickMime();
    const stream = this.canvas.captureStream(this.project.fps);
    for (const tr of this.recordDest?.stream.getAudioTracks() ?? []) stream.addTrack(tr);
    const rec = new MediaRecorder(stream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 6_000_000,
      audioBitsPerSecond: 160_000,
    });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const finished = new Promise<void>((ok) => (rec.onstop = () => ok()));
    const total = this.duration();
    const prevOnTime = this.onTime;
    this.onTime = (t) => {
      prevOnTime(t);
      onProgress(Math.min(0.99, t / total));
    };
    rec.start(500);
    await new Promise<void>((ok, fail) => {
      this.onEnded = () => ok();
      signal?.addEventListener("abort", () => {
        this.stop();
        fail(new DOMException("ยกเลิกแล้ว", "AbortError"));
      });
      this.play(true);
    }).finally(() => {
      this.onEnded = null;
      this.onTime = prevOnTime;
      // let the encoder flush the last frames
      window.setTimeout(() => rec.state !== "inactive" && rec.stop(), 250);
    });
    await finished;
    onProgress(1);
    const type = (mime || "video/webm").split(";")[0]!;
    return { blob: new Blob(chunks, { type }), mime: type };
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Load a picked file into a clip (duration + thumbnail). */
export async function clipFromFile(file: File): Promise<MediaClip> {
  const src = URL.createObjectURL(file);
  const id = Math.random().toString(36).slice(2, 10);
  if (file.type.startsWith("image/")) {
    const img = new Image();
    img.src = src;
    await img.decode().catch(() => undefined);
    return { id, kind: "image", src, name: file.name, srcDuration: 3, in: 0, out: 3, speed: 1, volume: 0, thumb: thumbOf(img, img.naturalWidth, img.naturalHeight) };
  }
  const v = document.createElement("video");
  v.src = src;
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  await new Promise<void>((ok) => {
    v.addEventListener("loadeddata", () => ok(), { once: true });
    v.addEventListener("error", () => ok(), { once: true });
    window.setTimeout(ok, 5000);
  });
  const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 5;
  await new Promise<void>((ok) => {
    v.addEventListener("seeked", () => ok(), { once: true });
    v.currentTime = Math.min(0.5, duration / 3);
    window.setTimeout(ok, 1500);
  });
  return { id, kind: "video", src, name: file.name, srcDuration: duration, in: 0, out: duration, speed: 1, volume: 1, thumb: thumbOf(v, v.videoWidth, v.videoHeight) };
}

function thumbOf(el: CanvasImageSource, w: number, h: number) {
  if (!w || !h) return undefined;
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = Math.round((96 * h) / w) || 96;
  c.getContext("2d")?.drawImage(el, 0, 0, c.width, c.height);
  try {
    return c.toDataURL("image/jpeg", 0.7);
  } catch {
    return undefined;
  }
}
