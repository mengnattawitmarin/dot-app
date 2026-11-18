import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deleteUpload, loadCommunity, reportUpload, uploadMedia, useCommunity, type Upload, type UploadKind } from "@/lib/community";
import { useAuth } from "@/lib/supabase";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { askSignIn } from "@/components/account";
import { CloseIcon, MoreIcon, PlayIcon, UploadIcon } from "@/components/icons";

const COPY: Record<UploadKind, { button: string; title: string; accept: string; hint: string }> = {
  story: { button: "อัปโหลดเรื่องเล่า", title: "อัปโหลดเรื่องเล่าของคุณ", accept: "audio/*", hint: "ไฟล์เสียง mp3 / m4a ไม่เกิน 50 MB (ประมาณ 45 นาทีที่ 128 kbps)" },
  film: { button: "อัปโหลดหนัง", title: "อัปโหลดหนัง / คลิปของคุณ", accept: "video/*", hint: "ไฟล์วิดีโอ mp4 ไม่เกิน 50 MB" },
};

/** Gold "+ อัปโหลด…" button; opens the upload sheet (or sign-in first). */
export function UploadButton({ kind, categories, className }: { kind: UploadKind; categories: Array<{ id: string; label: string }>; className?: string }) {
  const status = useCommunity((s) => s.status);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (useCommunity.getState().status === "idle") void loadCommunity();
  }, []);
  if (status === "off") return null;
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          if (!useAuth.getState().session) return askSignIn("เข้าสู่ระบบเพื่ออัปโหลดผลงานของคุณ");
          if (useCommunity.getState().status !== "ready") await loadCommunity();
          const state = useCommunity.getState();
          if (state.status !== "ready") {
            useApp.getState().toast(`ระบบอัปโหลดยังไม่พร้อม: ${state.error ?? "ลองใหม่อีกครั้ง"}`);
            return;
          }
          setOpen(true);
        }}
        className={cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-subtle px-3.5 text-xs font-medium text-gold ring-gold", className)}
      >
        <UploadIcon size={15} /> {COPY[kind].button}
      </button>
      {open ? <UploadSheet kind={kind} categories={categories} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function UploadSheet({ kind, categories, onClose }: { kind: UploadKind; categories: Array<{ id: string; label: string }>; onClose: () => void }) {
  const copy = COPY[kind];
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]?.label ?? "");
  const [description, setDescription] = useState("");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = file && title.trim() && rights && !busy;

  const submit = async () => {
    if (!file || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await uploadMedia(kind, file, { title, category, description });
      useApp.getState().toast(kind === "story" ? "อัปโหลดเรื่องเล่าแล้ว" : "อัปโหลดหนังแล้ว");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/60" onClick={busy ? undefined : onClose}>
      <div className="rise safe-bottom mx-auto max-h-[92%] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-elevated p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{copy.title}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="ปิด" className="grid size-9 place-items-center text-muted">
            <CloseIcon size={20} />
          </button>
        </div>

        <input ref={input} type="file" accept={copy.accept} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line bg-subtle p-4 text-left"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold-grad text-accent-fg">
            <UploadIcon size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm">{file ? file.name : "เลือกไฟล์"}</span>
            <span className="block text-[11px] text-faint">{file ? `${(file.size / 1e6).toFixed(1)} MB` : copy.hint}</span>
          </span>
        </button>

        <label className="mt-4 block text-xs text-faint">ชื่อเรื่อง</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder={kind === "story" ? "เช่น บ้านร้างท้ายซอย ตอนที่ 1" : "เช่น หนังสั้นของฉัน"}
          className="mt-1 h-11 w-full rounded-xl bg-subtle px-3 text-sm outline-none ring-gold placeholder:text-faint"
        />

        {categories.length ? (
          <>
            <label className="mt-3 block text-xs text-faint">หมวด</label>
            <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.label)}
                  className={cn("h-8 shrink-0 rounded-full px-3 text-xs ring-gold", category === c.label ? "bg-gold-grad text-accent-fg" : "bg-subtle text-muted")}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <label className="mt-3 block text-xs text-faint">รายละเอียด (ไม่บังคับ)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={600}
          rows={3}
          className="mt-1 w-full rounded-xl bg-subtle p-3 text-sm outline-none ring-gold"
        />

        <label className="mt-3 flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 accent-[var(--color-gold)]" />
          <span>ยืนยันว่าเป็นผลงานของฉันเอง หรือได้รับอนุญาตให้เผยแพร่ และไม่มีเนื้อหาผิดกฎหมาย ผลงานที่ถูกรายงานหลายครั้งจะถูกซ่อน</span>
        </label>

        {error ? <p className="mt-3 text-xs text-live">{error}</p> : null}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready}
          className="mt-4 h-11 w-full rounded-full bg-gold-grad text-sm font-semibold text-accent-fg disabled:opacity-40"
        >
          {busy ? "กำลังอัปโหลด…" : "อัปโหลด"}
        </button>
      </div>
    </div>,
    document.body,
  );
}

/** Row menu: delete your own upload, or report someone else's. */
export function UploadMenu({ upload }: { upload: Upload }) {
  const [open, setOpen] = useState(false);
  const act = async (fn: () => Promise<void>, done: string) => {
    setOpen(false);
    try {
      await fn();
      useApp.getState().toast(done);
    } catch (e) {
      useApp.getState().toast(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    }
  };
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="ตัวเลือก" className="grid size-8 place-items-center text-faint">
        <MoreIcon size={18} />
      </button>
      {open ? (
        <span className="absolute right-0 top-8 z-10 w-36 overflow-hidden rounded-xl bg-subtle text-sm ring-gold">
          {upload.mine ? (
            <button type="button" onClick={() => void act(() => deleteUpload(upload.id), "ลบแล้ว")} className="block w-full px-3 py-2.5 text-left text-live">
              ลบของฉัน
            </button>
          ) : (
            <>
              <button type="button" onClick={() => void act(() => reportUpload(upload.id, "ไม่เหมาะสม"), "รายงานแล้ว ขอบคุณครับ")} className="block w-full px-3 py-2.5 text-left">
                รายงานไม่เหมาะสม
              </button>
              <button type="button" onClick={() => void act(() => reportUpload(upload.id, "ละเมิดลิขสิทธิ์"), "รายงานแล้ว ขอบคุณครับ")} className="block w-full px-3 py-2.5 text-left">
                รายงานละเมิดลิขสิทธิ์
              </button>
            </>
          )}
        </span>
      ) : null}
    </span>
  );
}

/** List row used by both screens. */
export function UploadRow({ upload, onPlay }: { upload: Upload; onPlay: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <button type="button" onClick={onPlay} className="grid size-10 shrink-0 place-items-center rounded-full bg-subtle text-gold ring-gold" aria-label="เล่น">
        <PlayIcon size={15} className="translate-x-px" />
      </button>
      <button type="button" onClick={onPlay} className="min-w-0 flex-1 text-left">
        <span className="line-clamp-1 block text-sm">{upload.title}</span>
        <span className="block truncate text-[11px] text-faint">
          @{upload.handle}
          {upload.category ? ` · ${upload.category}` : ""}
          {upload.duration ? ` · ${Math.max(1, Math.round(upload.duration / 60))} นาที` : ""}
        </span>
      </button>
      <UploadMenu upload={upload} />
    </div>
  );
}
