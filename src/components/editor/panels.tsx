import { useRef, type ReactNode } from "react";
import { detectBeats } from "@/lib/editor/auto";
import {
  FILTERS,
  STICKERS,
  TEXT_COLORS,
  clipLength,
  timeline,
  uid,
  type Aspect,
  type FitMode,
  type FontId,
  type MediaClip,
  type Project,
  type TextAnim,
  type TextItem,
  type TextStyle,
  type TransitionId,
} from "@/lib/editor/types";
import { formatClock } from "@/lib/stories";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import {
  CropIcon,
  MusicIcon,
  ScissorsIcon,
  SlidersIcon,
  SmileIcon,
  SparkleIcon,
  TextIcon,
  WandIcon,
} from "@/components/icons";

export type PanelId = "clip" | "text" | "sticker" | "filter" | "adjust" | "music" | "effects" | "ratio";

export const PANEL_TABS: Array<{ id: PanelId; label: string; icon: typeof TextIcon }> = [
  { id: "clip", label: "ตัดต่อ", icon: ScissorsIcon },
  { id: "text", label: "ข้อความ", icon: TextIcon },
  { id: "sticker", label: "สติกเกอร์", icon: SmileIcon },
  { id: "music", label: "เสียง", icon: MusicIcon },
  { id: "filter", label: "ฟิลเตอร์", icon: WandIcon },
  { id: "adjust", label: "ปรับแต่ง", icon: SlidersIcon },
  { id: "effects", label: "เอฟเฟกต์", icon: SparkleIcon },
  { id: "ratio", label: "สัดส่วน", icon: CropIcon },
];

type Props = {
  panel: PanelId;
  project: Project;
  commit: (next: Project | ((p: Project) => Project)) => void;
  time: number;
  duration: number;
  selClip: string | null;
  setSelClip: (id: string | null) => void;
  selText: string | null;
  setSelText: (id: string | null) => void;
  seek: (t: number) => void;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-16 shrink-0 text-[11px] text-faint">{label}</span>
      <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("h-8 shrink-0 rounded-full px-3 text-xs", active ? "bg-gold-grad font-semibold text-accent-fg" : "bg-subtle text-muted ring-gold")}
    >
      {children}
    </button>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="flex items-center gap-2 py-1">
      <span className="w-16 shrink-0 text-[11px] text-faint">{label}</span>
      <input className="gold-range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted">
        {value}
        {suffix}
      </span>
    </label>
  );
}

export function EditorPanels(props: Props) {
  return (
    <div className="no-scrollbar h-[30vh] max-h-60 min-h-40 overflow-y-auto border-t border-white/10 bg-bg px-3 py-2">
      {props.panel === "clip" ? <ClipPanel {...props} /> : null}
      {props.panel === "text" ? <TextPanel {...props} /> : null}
      {props.panel === "sticker" ? <StickerPanel {...props} /> : null}
      {props.panel === "music" ? <MusicPanel {...props} /> : null}
      {props.panel === "filter" ? <FilterPanel {...props} /> : null}
      {props.panel === "adjust" ? <AdjustPanel {...props} /> : null}
      {props.panel === "effects" ? <EffectsPanel {...props} /> : null}
      {props.panel === "ratio" ? <RatioPanel {...props} /> : null}
    </div>
  );
}

/* ---------------- clip ---------------- */

function ClipPanel({ project, commit, time, selClip, setSelClip, seek }: Props) {
  const segs = timeline(project);
  const idx = project.clips.findIndex((c) => c.id === selClip);
  const clip = project.clips[idx];
  if (!clip) return <p className="py-6 text-center text-sm text-muted">แตะคลิปในแถบด้านบนเพื่อแก้ไข</p>;
  const seg = segs[idx]!;
  const update = (patch: Partial<MediaClip>) => commit((p) => ({ ...p, clips: p.clips.map((c) => (c.id === clip.id ? { ...c, ...patch } : c)) }));

  function split() {
    const local = time - seg.start;
    if (local < 0.2 || local > seg.length - 0.2) {
      useApp.getState().toast("เลื่อนตัวชี้ไปกลางคลิปที่จะแยก");
      return;
    }
    const cut = clip!.in + local * clip!.speed;
    const second: MediaClip = { ...clip!, id: uid(), in: cut };
    commit((p) => {
      const clips = [...p.clips];
      clips.splice(idx, 1, { ...clip!, out: cut }, second);
      return { ...p, clips };
    });
    setSelClip(second.id);
  }

  function move(dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= project.clips.length) return;
    commit((p) => {
      const clips = [...p.clips];
      [clips[idx], clips[j]] = [clips[j]!, clips[idx]!];
      return { ...p, clips };
    });
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs text-muted">
          คลิป {idx + 1}/{project.clips.length} · {clipLength(clip).toFixed(1)} วิ
        </p>
        <div className="flex gap-1.5">
          <Pill onClick={() => move(-1)}>◀</Pill>
          <Pill onClick={() => move(1)}>▶</Pill>
        </div>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        <Pill onClick={split}>✂️ แยกตรงนี้</Pill>
        <Pill
          onClick={() =>
            commit((p) => {
              const clips = [...p.clips];
              clips.splice(idx + 1, 0, { ...clip, id: uid() });
              return { ...p, clips };
            })
          }
        >
          ⧉ ทำซ้ำ
        </Pill>
        <Pill
          onClick={() => {
            commit((p) => ({ ...p, clips: p.clips.filter((c) => c.id !== clip.id) }));
            setSelClip(project.clips[idx + 1]?.id ?? project.clips[idx - 1]?.id ?? null);
          }}
        >
          🗑 ลบ
        </Pill>
      </div>
      {clip.kind === "video" ? (
        <>
          <Slider label="เริ่ม" value={Number(clip.in.toFixed(1))} min={0} max={Number(Math.max(0, clip.out - 0.3).toFixed(1))} step={0.1} suffix="s" onChange={(v) => { update({ in: v }); seek(seg.start); }} />
          <Slider label="จบ" value={Number(clip.out.toFixed(1))} min={Number((clip.in + 0.3).toFixed(1))} max={Number(clip.srcDuration.toFixed(1))} step={0.1} suffix="s" onChange={(v) => { update({ out: v }); seek(seg.start + (v - clip.in) / clip.speed - 0.05); }} />
          <Row label="ความเร็ว">
            {[0.25, 0.5, 1, 1.5, 2, 3].map((s) => (
              <Pill key={s} active={clip.speed === s} onClick={() => update({ speed: s })}>
                {s}×
              </Pill>
            ))}
          </Row>
          <Slider label="เสียงคลิป" value={Math.round(clip.volume * 100)} min={0} max={100} suffix="%" onChange={(v) => update({ volume: v / 100 })} />
        </>
      ) : (
        <Slider label="แสดงนาน" value={Number(clip.out.toFixed(1))} min={0.5} max={10} step={0.5} suffix="s" onChange={(v) => update({ out: v, srcDuration: v })} />
      )}
      <Row label="เคลื่อนไหว">
        {(
          [
            ["none", "นิ่ง"],
            ["zoom-in", "ซูมเข้า"],
            ["zoom-out", "ซูมออก"],
            ["pan", "แพน"],
          ] as const
        ).map(([id, label]) => (
          <Pill key={id} active={(clip.motion ?? (clip.kind === "image" ? "zoom-in" : "none")) === id} onClick={() => update({ motion: id })}>
            {label}
          </Pill>
        ))}
      </Row>
    </div>
  );
}

/* ---------------- text ---------------- */

const STYLES: Array<[TextStyle, string]> = [
  ["outline", "ขอบ"],
  ["box", "กล่อง"],
  ["neon", "นีออน"],
  ["shadow", "เงา"],
  ["plain", "ธรรมดา"],
];
const ANIMS: Array<[TextAnim, string]> = [
  ["pop", "เด้ง"],
  ["fade", "เฟด"],
  ["slide", "สไลด์"],
  ["type", "พิมพ์"],
  ["bounce", "กระดึ๊บ"],
  ["none", "ไม่มี"],
];
const FONTS: Array<[FontId, string]> = [
  ["display", "หนา"],
  ["sans", "ปกติ"],
  ["serif", "มีหัว"],
  ["hand", "ลายมือ"],
];

function addText(p: Project, time: number, duration: number, text: string, sticker = false): [Project, string] {
  const id = uid();
  const item: TextItem = {
    id,
    text,
    x: 0.5,
    y: sticker ? 0.35 : 0.72,
    size: sticker ? 0.12 : 0.055,
    color: "#ffffff",
    style: sticker ? "plain" : "outline",
    anim: "pop",
    font: "display",
    start: Math.min(time, Math.max(0, duration - 0.5)),
    end: Math.min(duration, time + 3),
    sticker,
  };
  return [{ ...p, texts: [...p.texts, item] }, id];
}

function TextPanel({ project, commit, time, duration, selText, setSelText }: Props) {
  const item = project.texts.find((t) => t.id === selText && !t.sticker);
  const update = (patch: Partial<TextItem>) => commit((p) => ({ ...p, texts: p.texts.map((t) => (t.id === item?.id ? { ...t, ...patch } : t)) }));

  if (!item) {
    const list = project.texts.filter((t) => !t.sticker);
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            const [p, id] = addText(project, time, duration, "ข้อความ");
            commit(p);
            setSelText(id);
          }}
          className="h-11 w-full rounded-xl bg-gold-grad text-sm font-semibold text-accent-fg"
        >
          ＋ เพิ่มข้อความที่ {formatClock(time)}
        </button>
        <p className="mt-2 text-[11px] text-faint">แตะข้อความบนวิดีโอเพื่อเลือก แล้วลากเพื่อย้ายตำแหน่ง</p>
        <div className="mt-2 flex flex-col gap-1">
          {list.map((t) => (
            <button key={t.id} type="button" onClick={() => setSelText(t.id)} className="flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-left text-sm">
              <span className="truncate">{t.text}</span>
              <span className="shrink-0 text-[10px] text-faint">
                {formatClock(t.start)}–{formatClock(t.end)}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          autoFocus
          onFocus={(e) => item.text === "ข้อความ" && e.currentTarget.select()}
          value={item.text}
          onChange={(e) => update({ text: e.target.value })}
          className="h-10 min-w-0 flex-1 rounded-xl bg-subtle px-3 text-sm outline-none focus:ring-2 focus:ring-gold"
        />
        <button type="button" onClick={() => setSelText(null)} className="h-10 rounded-xl bg-subtle px-3 text-xs text-muted">
          เสร็จ
        </button>
      </div>
      <Row label="สี">
        {TEXT_COLORS.map((c) => (
          <button key={c} type="button" onClick={() => update({ color: c })} aria-label={c} className={cn("size-7 shrink-0 rounded-full ring-1 ring-white/20", item.color === c && "ring-2 ring-gold")} style={{ background: c }} />
        ))}
      </Row>
      <Row label="สไตล์">
        {STYLES.map(([id, l]) => (
          <Pill key={id} active={item.style === id} onClick={() => update({ style: id })}>
            {l}
          </Pill>
        ))}
      </Row>
      <Row label="แอนิเมชัน">
        {ANIMS.map(([id, l]) => (
          <Pill key={id} active={item.anim === id} onClick={() => update({ anim: id })}>
            {l}
          </Pill>
        ))}
      </Row>
      <Row label="ฟอนต์">
        {FONTS.map(([id, l]) => (
          <Pill key={id} active={item.font === id} onClick={() => update({ font: id })}>
            {l}
          </Pill>
        ))}
      </Row>
      <Slider label="ขนาด" value={Math.round(item.size * 1000)} min={25} max={140} onChange={(v) => update({ size: v / 1000 })} />
      <TimingRow item={item} time={time} duration={duration} update={update} />
      <button type="button" onClick={() => { commit((p) => ({ ...p, texts: p.texts.filter((t) => t.id !== item.id) })); setSelText(null); }} className="mt-1 h-9 w-full rounded-xl bg-subtle text-xs text-live">
        ลบข้อความนี้
      </button>
    </div>
  );
}

function TimingRow({ item, time, duration, update }: { item: TextItem; time: number; duration: number; update: (p: Partial<TextItem>) => void }) {
  return (
    <Row label="ช่วงเวลา">
      <Pill onClick={() => update({ start: Math.min(time, item.end - 0.3) })}>เริ่ม = {formatClock(item.start)}</Pill>
      <Pill onClick={() => update({ end: Math.max(time, item.start + 0.3) })}>จบ = {formatClock(item.end)}</Pill>
      <Pill onClick={() => update({ start: 0, end: duration })}>ทั้งคลิป</Pill>
    </Row>
  );
}

/* ---------------- stickers ---------------- */

function StickerPanel({ project, commit, time, duration, selText, setSelText }: Props) {
  const item = project.texts.find((t) => t.id === selText && t.sticker);
  const update = (patch: Partial<TextItem>) => commit((p) => ({ ...p, texts: p.texts.map((t) => (t.id === item?.id ? { ...t, ...patch } : t)) }));
  return (
    <div>
      {item ? (
        <div className="mb-2 rounded-xl bg-subtle p-2">
          <Slider label={`ขนาด ${item.text}`} value={Math.round(item.size * 1000)} min={40} max={300} onChange={(v) => update({ size: v / 1000 })} />
          <Row label="แอนิเมชัน">
            {ANIMS.map(([id, l]) => (
              <Pill key={id} active={item.anim === id} onClick={() => update({ anim: id })}>
                {l}
              </Pill>
            ))}
          </Row>
          <TimingRow item={item} time={time} duration={duration} update={update} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setSelText(null)} className="h-8 flex-1 rounded-lg bg-bg text-xs text-muted">
              เสร็จ
            </button>
            <button type="button" onClick={() => { commit((p) => ({ ...p, texts: p.texts.filter((t) => t.id !== item.id) })); setSelText(null); }} className="h-8 flex-1 rounded-lg bg-bg text-xs text-live">
              ลบ
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-2 text-[11px] text-faint">แตะเพื่อใส่ที่ {formatClock(time)} · ลากบนวิดีโอเพื่อย้าย</p>
      )}
      <div className="grid grid-cols-8 gap-1">
        {STICKERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              const [p, id] = addText(project, time, duration, s, true);
              commit(p);
              setSelText(id);
            }}
            className="grid aspect-square place-items-center rounded-lg bg-subtle text-2xl active:scale-90"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- music ---------------- */

function MusicPanel({ project, commit }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const m = project.music;
  return (
    <div>
      <button type="button" onClick={() => input.current?.click()} className="h-11 w-full rounded-xl bg-gold-grad text-sm font-semibold text-accent-fg">
        {m ? `🎵 ${m.name} · เปลี่ยนเพลง` : "＋ เพิ่มเพลงจากเครื่อง"}
      </button>
      <input
        ref={input}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const src = URL.createObjectURL(f);
          commit((p) => ({ ...p, music: { src, name: f.name, offset: 0, volume: 0.8, fadeOut: true } }));
          try {
            const { beats } = await detectBeats(f);
            commit((p) => ({ ...p, beats }));
          } catch {
            /* beat zoom just won't have beats */
          }
        }}
      />
      {m ? (
        <>
          <Slider label="ดังเพลง" value={Math.round(m.volume * 100)} min={0} max={100} suffix="%" onChange={(v) => commit((p) => ({ ...p, music: p.music && { ...p.music, volume: v / 100 } }))} />
          <Slider label="เริ่มเพลงที่" value={Math.round(m.offset)} min={0} max={180} suffix="s" onChange={(v) => commit((p) => ({ ...p, music: p.music && { ...p.music, offset: v } }))} />
          <Row label="ตอนจบ">
            <Pill active={m.fadeOut} onClick={() => commit((p) => ({ ...p, music: p.music && { ...p.music, fadeOut: !p.music.fadeOut } }))}>
              เฟดออก
            </Pill>
            <Pill onClick={() => commit((p) => ({ ...p, music: null }))}>ลบเพลง</Pill>
          </Row>
        </>
      ) : null}
      <Slider label="เสียงคลิป" value={Math.round(project.origVolume * 100)} min={0} max={100} suffix="%" onChange={(v) => commit((p) => ({ ...p, origVolume: v / 100 }))} />
      <p className="mt-1 text-[11px] text-faint">ใช้เฉพาะเพลงที่คุณมีสิทธิ์ใช้ ถ้าจะโพสต์ลงแพลตฟอร์มอื่น</p>
    </div>
  );
}

/* ---------------- filter / adjust / effects / ratio ---------------- */

function FilterPanel({ project, commit }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {FILTERS.map((f) => (
        <button key={f.id} type="button" onClick={() => commit((p) => ({ ...p, filter: f.id }))} className="text-center">
          <span
            className={cn("mx-auto block aspect-square w-full rounded-xl", project.filter === f.id && "ring-2 ring-gold")}
            style={{ background: "linear-gradient(135deg,#f2b06b,#d6577a 45%,#3d6fd6)", filter: f.css || "none" }}
          />
          <span className={cn("mt-1 block text-[10px]", project.filter === f.id ? "text-gold" : "text-muted")}>{f.label}</span>
        </button>
      ))}
    </div>
  );
}

function AdjustPanel({ project, commit }: Props) {
  const a = project.adjust;
  const set = (k: keyof Project["adjust"], v: number) => commit((p) => ({ ...p, adjust: { ...p.adjust, [k]: v } }));
  return (
    <div>
      <Slider label="ความสว่าง" value={a.brightness} min={-50} max={50} onChange={(v) => set("brightness", v)} />
      <Slider label="คอนทราสต์" value={a.contrast} min={-50} max={50} onChange={(v) => set("contrast", v)} />
      <Slider label="ความสด" value={a.saturation} min={-100} max={100} onChange={(v) => set("saturation", v)} />
      <Slider label="อุณหภูมิสี" value={a.temperature} min={-50} max={50} onChange={(v) => set("temperature", v)} />
      <button type="button" onClick={() => commit((p) => ({ ...p, adjust: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 } }))} className="mt-1 h-8 rounded-full bg-subtle px-3 text-xs text-muted">
        รีเซ็ต
      </button>
    </div>
  );
}

function EffectsPanel({ project, commit }: Props) {
  const e = project.effects;
  const toggle = (k: keyof Project["effects"]) => commit((p) => ({ ...p, effects: { ...p.effects, [k]: !p.effects[k] } }));
  const transitions: Array<[TransitionId, string]> = [
    ["none", "ตัดตรง"],
    ["fade", "เฟดดำ"],
    ["flash", "แฟลช"],
    ["zoom", "ซูม"],
    ["slide", "สไลด์"],
  ];
  return (
    <div>
      <Row label="ทรานสิชัน">
        {transitions.map(([id, l]) => (
          <Pill key={id} active={project.transition === id} onClick={() => commit((p) => ({ ...p, transition: id }))}>
            {l}
          </Pill>
        ))}
      </Row>
      <Slider label="ความยาว" value={project.transitionLength} min={0.1} max={1} step={0.05} suffix="s" onChange={(v) => commit((p) => ({ ...p, transitionLength: v }))} />
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {(
          [
            ["beatZoom", "💥 ซูมตามบีท"],
            ["letterbox", "🎬 แถบหนัง"],
            ["grain", "🎞️ เกรนฟิล์ม"],
            ["vignette", "🌑 ขอบมืด"],
            ["dateStamp", "📅 วันที่ย้อนยุค"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" onClick={() => toggle(k)} className={cn("h-10 rounded-xl text-xs", e[k] ? "bg-gold-grad font-semibold text-accent-fg" : "bg-subtle text-muted ring-gold")}>
            {l}
          </button>
        ))}
        <button type="button" onClick={() => commit((p) => ({ ...p, watermark: !p.watermark }))} className={cn("h-10 rounded-xl text-xs", project.watermark ? "bg-gold-grad font-semibold text-accent-fg" : "bg-subtle text-muted ring-gold")}>
          ✨ ลายน้ำ Do.T
        </button>
      </div>
      {e.beatZoom && !project.beats.length ? <p className="mt-1 text-[11px] text-faint">ซูมตามบีทต้องใส่เพลงก่อน (แท็บเสียง)</p> : null}
    </div>
  );
}

function RatioPanel({ project, commit }: Props) {
  const ratios: Array<[Aspect, string]> = [
    ["9:16", "9:16 TikTok/Reels"],
    ["4:5", "4:5 IG"],
    ["1:1", "1:1"],
    ["16:9", "16:9 YouTube"],
  ];
  const fits: Array<[FitMode, string]> = [
    ["blur", "พื้นหลังเบลอ"],
    ["fill", "เต็มจอ (ครอป)"],
    ["fit", "พอดี (ขอบดำ)"],
  ];
  return (
    <div>
      <Row label="สัดส่วน">
        {ratios.map(([id, l]) => (
          <Pill key={id} active={project.aspect === id} onClick={() => commit((p) => ({ ...p, aspect: id }))}>
            {l}
          </Pill>
        ))}
      </Row>
      <Row label="การวาง">
        {fits.map(([id, l]) => (
          <Pill key={id} active={project.fit === id} onClick={() => commit((p) => ({ ...p, fit: id }))}>
            {l}
          </Pill>
        ))}
      </Row>
    </div>
  );
}
