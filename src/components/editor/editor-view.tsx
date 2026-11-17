import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { EditorEngine, clipFromFile } from "@/lib/editor/engine";
import { TEMPLATES, buildAutoProject, type TemplateId } from "@/lib/editor/auto";
import { emptyProject, projectDuration, timeline, type Project } from "@/lib/editor/types";
import { saveOrShareVideo } from "@/lib/editor/save";
import { formatClock } from "@/lib/stories";
import { pauseRadio } from "@/lib/player";
import { addMyClip } from "@/lib/my-clips";
import { uploadCloudClip } from "@/lib/cloud";
import { cloudEnabled, MAX_CLOUD_UPLOAD } from "@/lib/config";
import { useAuth } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ChevronLeft, CloseIcon, PauseIcon, PlayIcon, RedoIcon, ShareIcon, UndoIcon, WandIcon, ScissorsIcon } from "@/components/icons";
import { EditorPanels, PANEL_TABS, type PanelId } from "@/components/editor/panels";

type Mode = "home" | "auto" | "edit";

/* ---------------- history (undo / redo) ---------------- */

function useHistory(initial: Project) {
  const [state, setState] = useState({ past: [] as Project[], present: initial, future: [] as Project[] });
  const commit = useCallback((next: Project | ((p: Project) => Project)) => {
    setState((s) => {
      const value = typeof next === "function" ? next(s.present) : next;
      return { past: [...s.past, s.present].slice(-60), present: value, future: [] };
    });
  }, []);
  /** live update without a history entry (dragging) */
  const preview = useCallback((next: (p: Project) => Project) => setState((s) => ({ ...s, present: next(s.present) })), []);
  const undo = useCallback(() => setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1]!, future: [s.present, ...s.future] } : s)), []);
  const redo = useCallback(() => setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0]!, future: s.future.slice(1) } : s)), []);
  const reset = useCallback((p: Project) => setState({ past: [], present: p, future: [] }), []);
  /** record `before` as an undo step after a live (preview) edit such as a drag */
  const checkpoint = useCallback((before: Project) => setState((s) => ({ past: [...s.past, before].slice(-60), present: s.present, future: [] })), []);
  return { project: state.present, commit, preview, undo, redo, reset, checkpoint, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

export function EditorView() {
  const [mode, setMode] = useState<Mode>("home");
  const h = useHistory(emptyProject());

  const back = () => {
    if (mode === "home") useApp.getState().setTab("clipper");
    else if (h.project.clips.length && !window.confirm("ออกจากการตัดต่อ? งานที่ยังไม่ได้บันทึกจะหายไป")) return;
    else setMode("home");
  };

  if (mode === "auto") return <AutoSetup onBack={() => setMode("home")} onDone={(p) => { h.reset(p); setMode("edit"); }} />;
  if (mode === "edit") return <ManualEditor history={h} onBack={back} />;
  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-8">
      <div className="safe-top flex items-center gap-2 pb-3">
        <button type="button" onClick={back} className="grid size-9 place-items-center rounded-full bg-subtle text-gold ring-gold" aria-label="กลับ">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-semibold">ตัดต่อวิดีโอ</h1>
          <p className="text-[11px] text-muted">ทำในเครื่องทั้งหมด ไม่ต้องอัปโหลด</p>
        </div>
      </div>

      <button type="button" onClick={() => setMode("auto")} className="card-sheen rise mt-2 block w-full rounded-3xl p-5 text-left">
        <span className="grid size-12 place-items-center rounded-2xl bg-gold-grad text-accent-fg">
          <WandIcon size={24} />
        </span>
        <p className="mt-4 text-lg font-semibold">โหมด Auto</p>
        <p className="mt-1 text-sm text-muted">เลือกคลิป/รูป + เพลง แอปหาช่วงเด็ด ตัดตามจังหวะ ใส่ฟิลเตอร์ ทรานสิชัน และไตเติลให้เอง</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TEMPLATES.map((t) => (
            <span key={t.id} className="rounded-full bg-subtle px-2.5 py-1 text-[11px] text-gold-light">
              {t.emoji} {t.label}
            </span>
          ))}
        </div>
      </button>

      <ManualStart onReady={(p) => { h.reset(p); setMode("edit"); }} />

      <div className="mt-6 rounded-2xl bg-elevated p-4 text-xs leading-relaxed text-muted">
        <p className="mb-1 text-sm font-semibold text-fg">ทำอะไรได้บ้าง</p>
        ตัด · แยก · เรียงคลิป · ปรับความเร็ว · รูปภาพเคลื่อนไหว · ข้อความ 5 สไตล์ + แอนิเมชัน · สติกเกอร์ · ฟิลเตอร์ 10 แบบ · ปรับแสง/สี ·
        ทรานสิชัน 4 แบบ · เพลงประกอบ + เฟดออก · พื้นหลังเบลอ · แถบหนัง · เกรนฟิล์ม · วันที่ย้อนยุค · ซูมตามบีท · 9:16 / 1:1 / 4:5 / 16:9 ·
        ย้อนกลับ/ทำซ้ำ · บันทึกลงเครื่อง แชร์ไป TikTok/LINE หรือโพสต์ลง Clipper
      </div>
    </div>
  );
}

function ManualStart({ onReady }: { onReady: (p: Project) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="mt-3 block w-full rounded-3xl bg-elevated p-5 text-left ring-gold">
        <span className="grid size-12 place-items-center rounded-2xl bg-subtle text-gold ring-gold">
          <ScissorsIcon size={24} />
        </span>
        <p className="mt-4 text-lg font-semibold">{busy ? "กำลังเปิดคลิป…" : "โหมด Manual"}</p>
        <p className="mt-1 text-sm text-muted">คุมเองทุกอย่าง: ตัด แยก เรียง ความเร็ว ข้อความ สติกเกอร์ เพลง เอฟเฟกต์</p>
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (!files.length) return;
          setBusy(true);
          const p = emptyProject();
          for (const f of files) p.clips.push(await clipFromFile(f));
          setBusy(false);
          onReady(p);
        }}
      />
    </>
  );
}

/* ---------------- Auto setup ---------------- */

function AutoSetup({ onBack, onDone }: { onBack: () => void; onDone: (p: Project) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [music, setMusic] = useState<File | null>(null);
  const [template, setTemplate] = useState<TemplateId>("beat");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState(15);
  const [progress, setProgress] = useState<{ label: string; p: number } | null>(null);
  const clipsInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);

  async function run() {
    setProgress({ label: "เริ่ม", p: 0 });
    try {
      const p = await buildAutoProject({ files, template, music, title, target, onProgress: (label, v) => setProgress({ label, p: v }) });
      onDone(p);
    } catch (e) {
      useApp.getState().toast(e instanceof Error ? e.message : "สร้างวิดีโอไม่สำเร็จ");
      setProgress(null);
    }
  }

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-8">
      <div className="safe-top flex items-center gap-2 pb-3">
        <button type="button" onClick={onBack} className="grid size-9 place-items-center rounded-full bg-subtle text-gold ring-gold" aria-label="กลับ">
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-xl font-semibold">โหมด Auto</h1>
      </div>

      <p className="text-xs text-faint">1. เลือกคลิปหรือรูป (หลายไฟล์ได้)</p>
      <button type="button" onClick={() => clipsInput.current?.click()} className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-elevated text-sm ring-gold">
        {files.length ? `เลือกแล้ว ${files.length} ไฟล์ · แตะเพื่อเปลี่ยน` : "＋ เลือกคลิป / รูป"}
      </button>
      <input ref={clipsInput} type="file" accept="video/*,image/*" multiple className="hidden" onChange={(e) => { setFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />

      <p className="mt-5 text-xs text-faint">2. เลือกสไตล์</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplate(t.id)}
            className={cn("rounded-2xl p-3 text-left", template === t.id ? "bg-gold-grad text-accent-fg" : "bg-elevated ring-gold")}
          >
            <span className="text-2xl">{t.emoji}</span>
            <p className="mt-1 text-sm font-semibold">{t.label}</p>
            <p className={cn("text-[11px]", template === t.id ? "text-accent-fg/80" : "text-muted")}>{t.desc}</p>
          </button>
        ))}
      </div>

      <p className="mt-5 text-xs text-faint">3. เพลงประกอบ (ไม่ใส่ก็ได้ — ใส่แล้วจะตัดตามจังหวะเพลง)</p>
      <button type="button" onClick={() => musicInput.current?.click()} className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-elevated text-sm ring-gold">
        {music ? `🎵 ${music.name}` : "＋ เลือกไฟล์เพลงจากเครื่อง"}
      </button>
      <input ref={musicInput} type="file" accept="audio/*" className="hidden" onChange={(e) => { setMusic(e.target.files?.[0] ?? null); e.target.value = ""; }} />

      <p className="mt-5 text-xs text-faint">4. ไตเติล (ไม่ใส่ก็ได้)</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="เช่น ทริปเชียงใหม่ 2026" className="mt-2 h-12 w-full rounded-2xl bg-elevated px-4 text-sm outline-none ring-gold focus:ring-2 focus:ring-gold" />

      <p className="mt-5 text-xs text-faint">5. ความยาว</p>
      <div className="mt-2 flex gap-2">
        {[15, 30, 60, 0].map((s) => (
          <button key={s} type="button" onClick={() => setTarget(s)} className={cn("h-10 flex-1 rounded-xl text-sm", target === s ? "bg-gold-grad font-semibold text-accent-fg" : "bg-elevated text-muted ring-gold")}>
            {s ? `${s} วิ` : "อัตโนมัติ"}
          </button>
        ))}
      </div>

      <button type="button" disabled={!files.length || Boolean(progress)} onClick={() => void run()} className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold-grad text-base font-semibold text-accent-fg disabled:opacity-40">
        <WandIcon size={20} /> สร้างวิดีโออัตโนมัติ
      </button>
      {progress ? (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-gold transition-all" style={{ width: `${progress.p * 100}%` }} />
          </div>
          <p className="mt-2 text-center text-xs text-muted">{progress.label}…</p>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Manual editor ---------------- */

type History = ReturnType<typeof useHistory>;

function ManualEditor({ history, onBack }: { history: History; onBack: () => void }) {
  const { project, commit, preview, undo, redo, canUndo, canRedo, checkpoint } = history;
  const engineRef = useRef<EditorEngine | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState<PanelId>("clip");
  const [selClip, setSelClip] = useState<string | null>(project.clips[0]?.id ?? null);
  const [selText, setSelText] = useState<string | null>(null);
  const [exporting, setExporting] = useState<{ p: number; abort: AbortController } | null>(null);
  const [result, setResult] = useState<{ blob: Blob; mime: string; url: string } | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; before: Project } | null>(null);

  if (!engineRef.current) engineRef.current = new EditorEngine(project);
  const engine = engineRef.current;
  const duration = projectDuration(project);

  useEffect(() => {
    pauseRadio();
    holder.current?.appendChild(engine.canvas);
    engine.canvas.className = "h-full w-full object-contain";
    engine.onTime = setTime;
    engine.onPlayState = setPlaying;
    return () => engine.destroy();
  }, [engine]);

  useEffect(() => {
    void engine.setProject(project);
  }, [engine, project]);

  const segs = useMemo(() => timeline(project), [project]);
  const [aw, ah] = project.aspect.split(":").map(Number) as [number, number];

  function canvasPoint(e: RPointerEvent<HTMLDivElement>) {
    const r = engine.canvas.getBoundingClientRect();
    // canvas is object-contain inside its box
    const scale = Math.min(r.width / engine.canvas.width, r.height / engine.canvas.height);
    const w = engine.canvas.width * scale;
    const hgt = engine.canvas.height * scale;
    const ox = r.left + (r.width - w) / 2;
    const oy = r.top + (r.height - hgt) / 2;
    return { x: (e.clientX - ox) / w, y: (e.clientY - oy) / hgt };
  }

  function onPointerDown(e: RPointerEvent<HTMLDivElement>) {
    const pt = canvasPoint(e);
    const W = engine.canvas.width;
    const H = engine.canvas.height;
    const visible = project.texts.filter((t) => time >= t.start && time <= t.end).reverse();
    const hit = visible.find((t) => {
      const b = engine.textBox(t);
      const pad = 24;
      return pt.x * W >= b.x - pad && pt.x * W <= b.x + b.w + pad && pt.y * H >= b.y - pad && pt.y * H <= b.y + b.h + pad;
    });
    if (hit) {
      setSelText(hit.id);
      setPanel(hit.sticker ? "sticker" : "text");
      drag.current = { id: hit.id, dx: pt.x - hit.x, dy: pt.y - hit.y, before: project };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      engine.pause();
    } else {
      if (engine.playing) engine.pause();
      else engine.play();
    }
  }

  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const pt = canvasPoint(e);
    const { id, dx, dy } = drag.current;
    preview((p) => ({
      ...p,
      texts: p.texts.map((t) => (t.id === id ? { ...t, x: Math.min(0.98, Math.max(0.02, pt.x - dx)), y: Math.min(0.98, Math.max(0.02, pt.y - dy)) } : t)),
    }));
  }

  function onPointerUp() {
    if (!drag.current) return;
    const before = drag.current.before;
    drag.current = null;
    checkpoint(before); // the whole drag is one undo step
  }

  async function doExport() {
    engine.pause();
    const abort = new AbortController();
    setExporting({ p: 0, abort });
    try {
      const { blob, mime } = await engine.export((p) => setExporting((s) => (s ? { ...s, p } : s)), abort.signal);
      setResult({ blob, mime, url: URL.createObjectURL(blob) });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) useApp.getState().toast(e instanceof Error ? e.message : "ส่งออกไม่สำเร็จ");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex h-full flex-col bg-black">
      <div className="safe-top flex items-center gap-1 px-2 pb-2">
        <button type="button" onClick={onBack} className="grid size-10 place-items-center text-fg" aria-label="ออก">
          <CloseIcon size={22} />
        </button>
        <button type="button" onClick={undo} disabled={!canUndo} className="grid size-10 place-items-center text-fg disabled:opacity-30" aria-label="ย้อนกลับ">
          <UndoIcon size={20} />
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} className="grid size-10 place-items-center text-fg disabled:opacity-30" aria-label="ทำซ้ำ">
          <RedoIcon size={20} />
        </button>
        <span className="flex-1 text-center text-xs tabular-nums text-muted">
          {formatClock(time)} / {formatClock(duration)}
        </span>
        <button
          type="button"
          disabled={!project.clips.length}
          onClick={() => void doExport()}
          className="h-9 rounded-full bg-gold-grad px-4 text-sm font-semibold text-accent-fg disabled:opacity-40"
        >
          ส่งออก
        </button>
      </div>

      <div className="relative min-h-0 flex-1 px-3">
        <div ref={holder} className="relative mx-auto h-full max-w-full" style={{ aspectRatio: `${aw} / ${ah}` }} />
        <div
          className="absolute inset-0 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {!playing && project.clips.length ? (
          <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-fg">
            <PlayIcon size={26} className="translate-x-0.5" />
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 px-3 pt-2">
        <button type="button" onClick={() => (playing ? engine.pause() : engine.play())} className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-gold" aria-label={playing ? "หยุด" : "เล่น"}>
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} className="translate-x-px" />}
        </button>
        <input
          className="gold-range"
          type="range"
          min={0}
          max={Math.max(0.1, duration)}
          step={0.01}
          value={Math.min(time, duration)}
          aria-label="ตำแหน่ง"
          onChange={(e) => {
            engine.pause();
            void engine.seek(Number(e.target.value));
          }}
        />
      </div>

      {/* clip strip */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-2">
        {segs.map(({ clip, start, length }, i) => {
          const active = time >= start && time < start + length;
          return (
            <button
              key={clip.id}
              type="button"
              onClick={() => {
                setSelClip(clip.id);
                setPanel("clip");
                engine.pause();
                void engine.seek(start + 0.01);
              }}
              className={cn("relative h-14 shrink-0 overflow-hidden rounded-lg bg-subtle", selClip === clip.id ? "ring-2 ring-gold" : active ? "ring-1 ring-gold/50" : "")}
              style={{ width: Math.max(44, Math.min(160, length * 22)) }}
            >
              {clip.thumb ? <img src={clip.thumb} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
              <span className="absolute bottom-0.5 left-1 rounded bg-black/60 px-1 text-[9px] tabular-nums text-fg">
                {i + 1} · {length.toFixed(1)}s{clip.speed !== 1 ? ` · ${clip.speed}×` : ""}
              </span>
            </button>
          );
        })}
        <AddClipsButton
          onAdd={(clips) => {
            commit((p) => ({ ...p, clips: [...p.clips, ...clips] }));
            setSelClip(clips[0]?.id ?? selClip);
          }}
        />
      </div>

      <EditorPanels
        panel={panel}
        project={project}
        commit={commit}
        time={time}
        duration={duration}
        selClip={selClip}
        setSelClip={setSelClip}
        selText={selText}
        setSelText={setSelText}
        seek={(t) => void engine.seek(t)}
      />

      <div className="safe-bottom no-scrollbar flex gap-1 overflow-x-auto border-t border-white/10 px-2 py-1.5">
        {PANEL_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={cn("flex min-w-[58px] flex-col items-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px]", panel === id ? "text-gold" : "text-faint")}
          >
            <Icon size={20} />
            {label}
          </button>
        ))}
      </div>

      {exporting ? (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/85 px-8 text-center">
          <p className="text-lg font-semibold">กำลังส่งออกวิดีโอ</p>
          <p className="mt-1 text-xs text-muted">ใช้เวลาเท่าความยาววิดีโอ · เปิดหน้าจอไว้และอย่าสลับแอป</p>
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-gold-grad transition-all" style={{ width: `${exporting.p * 100}%` }} />
          </div>
          <p className="mt-2 text-sm tabular-nums text-gold-light">{Math.round(exporting.p * 100)}%</p>
          <button type="button" onClick={() => exporting.abort.abort()} className="mt-6 h-10 rounded-full bg-subtle px-5 text-sm text-muted ring-gold">
            ยกเลิก
          </button>
        </div>
      ) : null}

      {result ? (
        <ExportResult
          result={result}
          onClose={() => {
            URL.revokeObjectURL(result.url);
            setResult(null);
          }}
        />
      ) : null}
    </div>
  );
}

function AddClipsButton({ onAdd }: { onAdd: (clips: Project["clips"]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" onClick={() => input.current?.click()} className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-subtle text-xl text-gold ring-gold" aria-label="เพิ่มคลิป">
        {busy ? "…" : "＋"}
      </button>
      <input
        ref={input}
        type="file"
        accept="video/*,image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (!files.length) return;
          setBusy(true);
          const out = [];
          for (const f of files) out.push(await clipFromFile(f));
          setBusy(false);
          onAdd(out);
        }}
      />
    </>
  );
}

function ExportResult({ result, onClose }: { result: { blob: Blob; mime: string; url: string }; onClose: () => void }) {
  const session = useAuth((s) => s.session);
  const [busy, setBusy] = useState<string | null>(null);
  const sizeMb = result.blob.size / 1024 / 1024;

  async function act(kind: "save" | "share" | "post") {
    setBusy(kind);
    try {
      if (kind === "post") {
        const file = new File([result.blob], `DoT-${Date.now()}.${result.mime.includes("mp4") ? "mp4" : "webm"}`, { type: result.mime });
        const online = cloudEnabled && session && result.blob.size <= MAX_CLOUD_UPLOAD;
        if (online) await uploadCloudClip(file, "ตัดต่อด้วย Do.T ✂️");
        else await addMyClip(file, "ตัดต่อด้วย Do.T ✂️");
        useApp.getState().toast(online ? "โพสต์ลง Clipper สาธารณะแล้ว" : "เก็บลง Clipper (ในเครื่อง) แล้ว");
        useApp.getState().setTab("clipper");
        return;
      }
      const uri = await saveOrShareVideo(result.blob, result.mime, kind);
      if (kind === "save") useApp.getState().toast(uri ? "บันทึกแล้ว (โฟลเดอร์ Movies/DoT)" : "บันทึกแล้ว");
    } catch (e) {
      useApp.getState().toast(e instanceof Error ? e.message : "ทำไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-bg">
      <div className="safe-top flex items-center justify-between px-3 pb-2">
        <button type="button" onClick={onClose} className="flex items-center gap-1 text-sm text-gold" aria-label="แก้ต่อ">
          <ChevronLeft size={18} /> แก้ต่อ
        </button>
        <p className="text-sm font-semibold">เสร็จแล้ว 🎉</p>
        <span className="w-14" />
      </div>
      <div className="min-h-0 flex-1 px-4">
        <video src={result.url} controls playsInline autoPlay className="mx-auto h-full max-w-full rounded-2xl bg-black" />
      </div>
      <p className="mt-2 text-center text-[11px] text-faint">
        {result.mime.includes("mp4") ? "MP4" : "WebM"} · {sizeMb.toFixed(1)} MB
      </p>
      <div className="safe-bottom grid grid-cols-3 gap-2 p-4">
        <button type="button" disabled={Boolean(busy)} onClick={() => void act("save")} className="flex h-14 flex-col items-center justify-center rounded-2xl bg-elevated text-xs ring-gold">
          <span className="text-lg">⬇️</span>
          {busy === "save" ? "กำลังบันทึก…" : "บันทึกลงเครื่อง"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void act("share")} className="flex h-14 flex-col items-center justify-center rounded-2xl bg-elevated text-xs ring-gold">
          <ShareIcon size={18} />
          {busy === "share" ? "กำลังเปิด…" : "แชร์ / TikTok"}
        </button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void act("post")} className="flex h-14 flex-col items-center justify-center rounded-2xl bg-gold-grad text-xs font-semibold text-accent-fg">
          <span className="text-lg">🎬</span>
          {busy === "post" ? "กำลังโพสต์…" : "โพสต์ Clipper"}
        </button>
      </div>
    </div>
  );
}
