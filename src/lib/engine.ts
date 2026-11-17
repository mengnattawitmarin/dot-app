import type { StudioPreset } from "@/lib/catalog";

const BPM: Record<StudioPreset, number> = {
  "night-drive": 96,
  loft: 74,
  focus: 56,
  club: 122,
  after: 88,
  rain: 62,
};

function midi(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function makeNoise(ctx: AudioContext) {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export class StudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private bins = new Uint8Array(32);
  private noise: AudioBuffer | null = null;
  private bus: GainNode | null = null;
  private beds: Array<AudioBufferSourceNode | OscillatorNode> = [];
  private timer = 0;
  private nextTime = 0;
  private beat = 0;
  private running = false;
  private paused = false;
  private volume = 0.85;
  preset: StudioPreset | null = null;

  async prepare() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  private ensure() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.005;
    comp.release.value = 0.18;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    comp.connect(analyser);
    analyser.connect(master);
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.comp = comp;
    this.analyser = analyser;
    this.bins = new Uint8Array(analyser.frequencyBinCount);
    this.noise = makeNoise(ctx);
    return ctx;
  }

  async start(preset: StudioPreset) {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    this.haltLoop();
    this.killBeds();
    if (this.bus) this.bus.disconnect();
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(this.comp!);
    this.bus = bus;
    this.preset = preset;
    this.beat = 0;
    this.paused = false;
    this.nextTime = ctx.currentTime + 0.06;
    this.master!.gain.setTargetAtTime(Math.max(0.0001, this.volume), ctx.currentTime, 0.03);
    this.startBeds(preset);
    this.running = true;
    this.loop();
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    this.paused = true;
    this.haltLoop();
    void this.ctx?.suspend();
  }

  async resume() {
    if (!this.paused || !this.ctx || !this.bus || !this.preset) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.paused = false;
    this.running = true;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.loop();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.preset = null;
    this.haltLoop();
    this.killBeds();
    if (this.bus) {
      this.bus.disconnect();
      this.bus = null;
    }
  }

  isRunning() {
    return this.running;
  }

  isPaused() {
    return this.paused;
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(Math.max(0.0001, volume), this.ctx.currentTime, 0.03);
  }

  getLevels(): number[] {
    const out = Array.from({ length: 12 }, () => 0.08);
    if (!this.analyser || !this.running) return out;
    this.analyser.getByteFrequencyData(this.bins);
    const count = this.bins.length;
    for (let i = 0; i < 12; i += 1) {
      const start = Math.floor((i * count) / 12);
      const end = Math.max(start + 1, Math.floor(((i + 1) * count) / 12));
      let sum = 0;
      for (let j = start; j < end; j += 1) sum += this.bins[j] ?? 0;
      out[i] = Math.min(1, (sum / (end - start) / 255) * 1.4);
    }
    return out;
  }

  private haltLoop() {
    window.clearTimeout(this.timer);
  }

  private killBeds() {
    for (const node of this.beds) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
      node.disconnect();
    }
    this.beds = [];
  }

  private loop = () => {
    if (!this.running || !this.ctx || !this.preset) return;
    const horizon = this.ctx.currentTime + 0.28;
    while (this.nextTime < horizon) {
      this.schedule(this.nextTime, this.beat, this.preset);
      this.nextTime += 60 / BPM[this.preset];
      this.beat += 1;
    }
    this.timer = window.setTimeout(this.loop, 70);
  };

  private startBeds(preset: StudioPreset) {
    const ctx = this.ctx;
    const bus = this.bus;
    const noise = this.noise;
    if (!ctx || !bus || !noise) return;

    const wantsNoise = preset !== "club";
    if (wantsNoise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      if (preset === "loft") {
        filter.type = "lowpass";
        filter.frequency.value = 1600;
        gain.gain.value = 0.03;
      } else if (preset === "rain") {
        filter.type = "highpass";
        filter.frequency.value = 700;
        gain.gain.value = 0.09;
      } else if (preset === "focus") {
        filter.type = "highpass";
        filter.frequency.value = 500;
        gain.gain.value = 0.04;
      } else if (preset === "after") {
        filter.type = "highpass";
        filter.frequency.value = 2400;
        gain.gain.value = 0.012;
      } else {
        filter.type = "bandpass";
        filter.frequency.value = 420;
        filter.Q.value = 0.45;
        gain.gain.value = 0.02;
      }
      src.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      src.start();
      this.beds.push(src);
    }

    if (preset === "focus") {
      this.beds.push(this.drone(110, 0.055));
      this.beds.push(this.drone(110.6, 0.035));
      this.beds.push(this.drone(164.81, 0.018));
    }
  }

  private drone(freq: number, vol: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.value = 800;
    gain.gain.value = vol;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus!);
    osc.start();
    return osc;
  }

  private tone(
    time: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    cutoff: number,
  ) {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  private kick(time: number, vol: number) {
    const ctx = this.ctx;
    const bus = this.bus;
    if (!ctx || !bus) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(148, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.09);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.26);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  private hat(time: number, vol: number, open = false) {
    const ctx = this.ctx;
    const bus = this.bus;
    const noise = this.noise;
    if (!ctx || !bus || !noise) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = open ? 4800 : 7600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (open ? 0.16 : 0.045));
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start(time);
    src.stop(time + (open ? 0.2 : 0.06));
  }

  private schedule(time: number, beat: number, preset: StudioPreset) {
    const step = beat % 8;
    const half = 60 / BPM[preset] / 2;
    if (preset === "night-drive") {
      const bass = [45, 45, 48, 45, 43, 43, 41, 43][step] ?? 45;
      this.tone(time, midi(bass), 0.34, "sine", 0.16, 240);
      this.kick(time, step % 2 === 0 ? 0.2 : 0.08);
      this.hat(time + half, 0.03);
      if (step % 4 === 0) {
        this.tone(time, midi(69), 1.6, "triangle", 0.035, 900);
        this.tone(time, midi(72), 1.6, "triangle", 0.028, 900);
        this.tone(time, midi(76), 1.6, "sine", 0.02, 1200);
      }
      return;
    }
    if (preset === "loft") {
      const chords = [
        [57, 60, 64, 67],
        [53, 57, 60, 64],
        [48, 52, 55, 59],
        [55, 59, 62, 66],
      ];
      const chord = chords[Math.floor(beat / 4) % chords.length] ?? chords[0];
      if (step % 4 === 0 && chord) {
        for (const note of chord) this.tone(time, midi(note), 1.9, "triangle", 0.045, 980);
      }
      if (step % 2 === 0) this.kick(time, 0.08);
      if (step % 4 === 2 && chord) {
        const top = chord[chord.length - 1] ?? 67;
        this.tone(time, midi(top + 12), 0.45, "sine", 0.04, 1800);
      }
      return;
    }
    if (preset === "focus") {
      if (step === 0) {
        const bells = [72, 76, 79, 74, 81, 76];
        const note = bells[Math.floor(beat / 8) % bells.length] ?? 72;
        this.tone(time, midi(note), 2.4, "sine", 0.03, 1400);
      }
      return;
    }
    if (preset === "club") {
      const roots = [36, 36, 34, 36];
      const root = roots[Math.floor(beat / 4) % roots.length] ?? 36;
      this.kick(time, 0.28);
      this.hat(time, 0.04);
      this.hat(time + half, step % 4 === 3 ? 0.07 : 0.035, step % 4 === 3);
      this.tone(time + half, midi(root), 0.22, "sine", 0.14, 220);
      if (step % 8 === 4) this.tone(time, midi(root + 12), 0.18, "triangle", 0.05, 500);
      return;
    }
    if (preset === "after") {
      const walk = [40, 43, 45, 46, 48, 46, 45, 43];
      const note = walk[step] ?? 40;
      this.tone(time, midi(note), 0.42, "triangle", 0.11, 380);
      if (step % 2 === 1) this.hat(time, 0.025);
      if (step === 0) {
        this.tone(time, midi(60), 1.5, "sine", 0.03, 900);
        this.tone(time, midi(64), 1.5, "sine", 0.025, 900);
        this.tone(time, midi(67), 1.5, "sine", 0.02, 900);
      }
      return;
    }
    if (step % 3 === 0) {
      const bells = [76, 79, 83, 74, 81, 72, 84];
      const note = bells[beat % bells.length] ?? 76;
      this.tone(time, midi(note), 1.8, "sine", 0.035, 2000);
    }
  }
}

export const studio = new StudioEngine();
