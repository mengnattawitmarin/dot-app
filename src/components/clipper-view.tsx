import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { clips, type Clip } from "@/lib/catalog";
import { addMyClip, listMyClips, removeMyClip } from "@/lib/my-clips";
import { addComment, deleteCloudClip, fetchCloudClips, fetchComments, reportClip, setCloudLike, uploadCloudClip, type CloudComment } from "@/lib/cloud";
import { cloudEnabled } from "@/lib/config";
import { useAuth } from "@/lib/supabase";
import { askSignIn } from "@/components/account";
import { pauseRadio } from "@/lib/player";
import { REMOTE_BASE } from "@/lib/remote";
import { shareContent } from "@/lib/share";
import { loadValue, saveValue } from "@/lib/storage";
import { selectOffline, useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { hashPalette } from "@/components/art";
import {
  BookmarkIcon,
  CloseIcon,
  GlobeIcon,
  MoreIcon,
  CommentIcon,
  HeartIcon,
  MusicIcon,
  PauseIcon,
  PlusIcon,
  ScissorsIcon,
  SendIcon,
  ShareIcon,
  TrashIcon,
  VolumeIcon,
} from "@/components/icons";

const compact = new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (n: number) => compact.format(n);

const FOLLOW_KEY = "dot-following-v1";
const COMMENTS_KEY = "dot-comments-v1";
const HIDDEN_KEY = "dot-hidden-clips-v1";

type MyComment = { text: string; at: number };

const SEED_COMMENTS = [
  ["noon.bkk", "ดูวนไปสามรอบแล้ว 😂"],
  ["pimmy", "ภาพสวยมาก ทำได้ไงเนี่ย"],
  ["tonkla", "ขอภาคต่อด่วน ๆ 🙏"],
  ["mew_mew", "เพลงประกอบคือดีย์"],
  ["jj.chiangmai", "ส่งให้แฟนดูแล้ว 555"],
  ["oat.pattaya", "รอบนี้มาไว 🔥"],
  ["fah", "ชอบตอนท้ายสุด"],
  ["bank99", "ใครมาจากหน้าแรกบ้าง"],
];

function seededComments(clip: Clip) {
  let h = 0;
  for (const c of clip.id) h = (h * 17 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: 5 }, (_, i) => SEED_COMMENTS[(h + i * 3) % SEED_COMMENTS.length]!);
}

export function ClipperView() {
  const offline = useApp(selectOffline);
  const session = useAuth((s) => s.session);
  const [mine, setMine] = useState<Clip[]>([]);
  const [cloud, setCloud] = useState<Clip[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const feed = useMemo(
    () => [...mine, ...(offline ? [] : [...cloud, ...clips])].filter((c) => !hidden.includes(c.id)),
    [mine, cloud, offline, hidden],
  );
  const [active, setActive] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [following, setFollowing] = useState<string[]>([]);
  const [commentsFor, setCommentsFor] = useState<Clip | null>(null);
  const [draft, setDraft] = useState<File | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listMyClips().then(setMine);
    void loadValue(FOLLOW_KEY).then((raw) => raw && setFollowing(JSON.parse(raw) as string[]));
    void loadValue(HIDDEN_KEY).then((raw) => raw && setHidden(JSON.parse(raw) as string[]));
  }, []);

  useEffect(() => {
    if (!offline) void fetchCloudClips().then(setCloud);
  }, [session, offline]);

  function hide(clip: Clip) {
    const next = [...hidden, clip.id];
    setHidden(next);
    void saveValue(HIDDEN_KEY, JSON.stringify(next.slice(-500)));
  }

  useEffect(() => {
    if (soundOn) pauseRadio();
  }, [soundOn]);

  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(Number((e.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll<HTMLElement>("[data-index]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [feed.length]);

  function toggleFollow(author: string) {
    const next = following.includes(author) ? following.filter((a) => a !== author) : [...following, author];
    setFollowing(next);
    void saveValue(FOLLOW_KEY, JSON.stringify(next));
  }

  async function remove(clip: Clip) {
    if (clip.cloud) {
      await deleteCloudClip(clip);
      setCloud((list) => list.filter((c) => c.id !== clip.id));
    } else {
      await removeMyClip(clip.id);
      setMine((list) => list.filter((c) => c.id !== clip.id));
    }
    useApp.getState().toast("ลบคลิปแล้ว");
  }

  async function report(clip: Clip) {
    try {
      await reportClip(clip.id, "inappropriate");
      hide(clip);
      useApp.getState().toast("ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแลชุมชน");
    } catch (e) {
      if (!session) askSignIn("เข้าสู่ระบบเพื่อรายงานคลิป");
      else useApp.getState().toast(e instanceof Error ? e.message : "รายงานไม่สำเร็จ");
    }
  }

  return (
    <div className="relative h-full bg-black">
      <div ref={scroller} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain">
        {feed.map((clip, i) => (
          <ClipItem
            key={clip.id}
            clip={clip}
            index={i}
            active={i === active}
            near={Math.abs(i - active) <= 1}
            soundOn={soundOn}
            following={following.includes(clip.author)}
            onFollow={() => toggleFollow(clip.author)}
            onSound={() => setSoundOn((v) => !v)}
            onComments={() => setCommentsFor(clip)}
            onDelete={clip.mine ? () => void remove(clip) : undefined}
            onHide={() => hide(clip)}
            onReport={clip.cloud && !clip.mine ? () => void report(clip) : undefined}
          />
        ))}
        {feed.length === 0 ? (
          <div className="grid h-full place-items-center px-8 text-center text-sm text-muted">
            ออฟไลน์อยู่ — คลิปออนไลน์จะกลับมาเมื่อมีเน็ต กด + เพื่อดูหรือเพิ่มคลิปของคุณเอง
          </div>
        ) : null}
      </div>

      {/* top bar */}
      <div className="safe-top pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent pb-8">
        <div className="pointer-events-auto flex items-center justify-between px-4 pt-1">
          <p className="font-display text-2xl font-bold text-gold-grad">Clipper</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundOn((v) => !v)}
              aria-label={soundOn ? "ปิดเสียง" : "เปิดเสียง"}
              className="grid size-10 place-items-center rounded-full bg-black/40 text-fg"
            >
              <VolumeIcon size={20} muted={!soundOn} />
            </button>
            <button
              type="button"
              onClick={() => useApp.getState().setTab("editor")}
              aria-label="ตัดต่อวิดีโอ"
              className="flex h-10 items-center gap-1.5 rounded-full bg-black/40 px-3 text-sm text-fg ring-gold"
            >
              <ScissorsIcon size={18} /> ตัดต่อ
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              aria-label="เพิ่มคลิป"
              className="grid size-10 place-items-center rounded-full bg-gold-grad text-accent-fg"
            >
              <PlusIcon size={20} />
            </button>
          </div>
        </div>
        {!soundOn && feed.length > 0 ? (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setSoundOn(true)}
              className="pointer-events-auto rounded-full bg-black/55 px-3 py-1 text-xs text-fg ring-gold"
            >
              🔇 แตะเพื่อเปิดเสียง
            </button>
          </div>
        ) : null}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setDraft(f);
          e.target.value = "";
        }}
      />

      {commentsFor ? <CommentsSheet clip={commentsFor} onClose={() => setCommentsFor(null)} /> : null}
      {draft ? (
        <UploadSheet
          file={draft}
          onClose={() => setDraft(null)}
          onPosted={(clip) => {
            setDraft(null);
            if (clip.cloud) setCloud((list) => [clip, ...list]);
            else setMine((list) => [clip, ...list]);
            setActive(0);
            // wait for the new item to render, then jump to it (scroll anchoring would keep the old clip in view)
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => scroller.current?.scrollTo({ top: 0 })));
            useApp.getState().toast(clip.cloud ? "โพสต์สาธารณะแล้ว 🎉" : "บันทึกคลิปในเครื่องแล้ว");
          }}
        />
      ) : null}
    </div>
  );
}

function ClipItem({
  clip,
  index,
  active,
  near,
  soundOn,
  following,
  onFollow,
  onSound,
  onComments,
  onDelete,
  onHide,
  onReport,
}: {
  clip: Clip;
  index: number;
  active: boolean;
  near: boolean;
  soundOn: boolean;
  following: boolean;
  onFollow: () => void;
  onSound: () => void;
  onComments: () => void;
  onDelete?: () => void;
  onHide: () => void;
  onReport?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const liked = useApp((s) => s.liked.includes(clip.id));
  const saved = useApp((s) => s.favorites.includes(clip.id));
  const lastTap = useRef(0);
  const tapTimer = useRef(0);
  const start = clip.start ?? 0;
  const [a, b] = hashPalette(clip.author);

  useEffect(() => {
    if (!active) setPaused(false);
  }, [active]);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (active && !paused) {
      el.muted = !soundOn;
      el.play().catch(() => {
        el.muted = true;
        void el.play().catch(() => setPaused(true));
      });
    } else {
      el.pause();
    }
  }, [active, paused, soundOn, near]);

  function onTap(e: MouseEvent<HTMLDivElement>) {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    if (now - lastTap.current < 280) {
      window.clearTimeout(tapTimer.current);
      lastTap.current = 0;
      const id = now;
      setHearts((h) => [...h, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      window.setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 900);
      if (!liked) toggleLike();
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => setPaused((p) => !p), 280);
  }

  function toggleLike() {
    if (clip.cloud && !useAuth.getState().session) return askSignIn("เข้าสู่ระบบเพื่อถูกใจคลิป");
    useApp.getState().toggleLike(clip.id);
    if (clip.cloud) void setCloudLike(clip.id, !liked);
  }

  async function share() {
    await shareContent({ title: "Do.T Clipper", text: `🎬 ${clip.caption} — ดูบน Do.T`, url: REMOTE_BASE });
  }

  return (
    <article data-index={index} className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      <div className="absolute inset-0" style={{ background: `radial-gradient(80% 60% at 50% 40%, ${b}, #000 80%)` }} />
      {near ? (
        <video
          ref={video}
          src={start ? `${clip.src}#t=${start}` : clip.src}
          className="absolute inset-0 h-full w-full object-cover"
          playsInline
          muted
          loop={!clip.end}
          preload={active ? "auto" : "metadata"}
          onLoadedMetadata={(e) => {
            if (start) e.currentTarget.currentTime = start;
          }}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            const end = clip.end ?? el.duration;
            if (clip.end && el.currentTime >= clip.end) el.currentTime = start;
            if (end > start) setProgress(Math.min(1, Math.max(0, (el.currentTime - start) / (end - start))));
          }}
        />
      ) : null}

      {/* tap layer */}
      <div className="absolute inset-0" onClick={onTap} />
      {hearts.map((h) => (
        <span
          key={h.id}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-[heart_0.9s_ease-out_forwards] text-live"
          style={{ left: h.x, top: h.y }}
        >
          <HeartIcon size={96} filled />
        </span>
      ))}
      {paused && active ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-fg">
          <PauseIcon size={34} />
        </span>
      ) : null}
      {loading && active && !paused ? (
        <span className="pointer-events-none absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-gold/30 border-t-gold" />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      {/* right rail */}
      <div className="absolute bottom-10 right-2 flex flex-col items-center gap-4">
        <div className="relative mb-1">
          <span
            className="grid size-12 place-items-center rounded-full font-display text-sm font-bold text-fg ring-2 ring-fg"
            style={{ background: `linear-gradient(140deg, ${a}, ${b})` }}
          >
            {clip.author.slice(0, 2).toUpperCase()}
          </span>
          {!clip.mine ? (
            <button
              type="button"
              onClick={onFollow}
              aria-label={following ? "เลิกติดตาม" : "ติดตาม"}
              className={cn(
                "absolute -bottom-2 left-1/2 grid size-5 -translate-x-1/2 place-items-center rounded-full text-[11px] font-bold",
                following ? "bg-fg text-bg" : "bg-live text-white",
              )}
            >
              {following ? "✓" : "+"}
            </button>
          ) : null}
        </div>
        <RailButton label={fmt(clip.likes + (liked ? 1 : 0))} onClick={toggleLike} aria={liked ? "เลิกถูกใจ" : "ถูกใจ"}>
          <HeartIcon size={30} filled={liked} className={liked ? "text-live" : "text-fg"} />
        </RailButton>
        <RailButton label={fmt(clip.comments)} onClick={onComments} aria="ความคิดเห็น">
          <CommentIcon size={28} />
        </RailButton>
        <RailButton label={saved ? "บันทึกแล้ว" : "บันทึก"} onClick={() => useApp.getState().toggleFavorite(clip.id)} aria="บันทึก">
          <BookmarkIcon size={28} filled={saved} className={saved ? "text-gold" : "text-fg"} />
        </RailButton>
        <RailButton label={fmt(clip.shares)} onClick={() => void share()} aria="แชร์">
          <ShareIcon size={28} />
        </RailButton>
        {onDelete ? (
          <RailButton label="ลบ" onClick={onDelete} aria="ลบคลิป">
            <TrashIcon size={26} />
          </RailButton>
        ) : (
          <RailButton label="" onClick={() => setMenu(true)} aria="ตัวเลือกเพิ่มเติม">
            <MoreIcon size={26} />
          </RailButton>
        )}
      </div>

      {menu ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/50" onClick={() => setMenu(false)}>
          <div className="rise rounded-t-3xl bg-elevated p-2 pb-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onHide();
              }}
              className="flex h-12 w-full items-center px-4 text-left text-sm"
            >
              ไม่สนใจคลิปนี้
            </button>
            {onReport ? (
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onReport();
                }}
                className="flex h-12 w-full items-center px-4 text-left text-sm text-live"
              >
                รายงานคลิปไม่เหมาะสม
              </button>
            ) : null}
            <button type="button" onClick={() => setMenu(false)} className="flex h-12 w-full items-center px-4 text-left text-sm text-muted">
              ยกเลิก
            </button>
          </div>
        </div>
      ) : null}

      {/* caption */}
      <div className="absolute bottom-4 left-0 right-16 px-4">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-semibold text-fg">@{clip.author}</p>
          {!clip.mine ? (
            <button
              type="button"
              onClick={onFollow}
              className={cn("rounded-md px-2 py-0.5 text-xs font-medium", following ? "bg-white/15 text-fg" : "ring-1 ring-fg text-fg")}
            >
              {following ? "กำลังติดตาม" : "ติดตาม"}
            </button>
          ) : null}
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1.5 block text-left">
          <p className={cn("text-sm leading-snug text-fg/95", !expanded && "line-clamp-2")}>{clip.caption}</p>
        </button>
        <button type="button" onClick={onSound} className="mt-2 flex max-w-full items-center gap-1.5 overflow-hidden text-xs text-fg/85">
          <MusicIcon size={14} className="shrink-0" />
          <span className="truncate">เสียงต้นฉบับ · {clip.credit}</span>
        </button>
      </div>

      {/* progress */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/15">
        <div className="h-full bg-gold" style={{ width: `${progress * 100}%` }} />
      </div>
    </article>
  );
}

function RailButton({ children, label, onClick, aria }: { children: ReactNode; label: string; onClick: () => void; aria: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={aria} className="flex flex-col items-center gap-1 text-fg drop-shadow">
      {children}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

function CommentsSheet({ clip, onClose }: { clip: Clip; onClose: () => void }) {
  const [mine, setMine] = useState<MyComment[]>([]);
  const [remote, setRemote] = useState<CloudComment[]>([]);
  const [text, setText] = useState("");
  const seeded = useMemo(() => (clip.mine || clip.cloud ? [] : seededComments(clip)), [clip]);

  useEffect(() => {
    if (clip.cloud) {
      void fetchComments(clip.id).then(setRemote);
      return;
    }
    void loadValue(COMMENTS_KEY).then((raw) => {
      const all = raw ? (JSON.parse(raw) as Record<string, MyComment[]>) : {};
      setMine(all[clip.id] ?? []);
    });
  }, [clip.id]);

  async function send() {
    const t = text.trim();
    if (!t) return;
    if (clip.cloud) {
      if (!useAuth.getState().session) return askSignIn("เข้าสู่ระบบเพื่อคอมเมนต์");
      try {
        await addComment(clip.id, t);
        setText("");
        setRemote(await fetchComments(clip.id));
      } catch (e) {
        useApp.getState().toast(e instanceof Error ? e.message : "ส่งไม่สำเร็จ");
      }
      return;
    }
    const next = [{ text: t, at: Date.now() }, ...mine];
    setMine(next);
    setText("");
    const raw = await loadValue(COMMENTS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, MyComment[]>) : {};
    all[clip.id] = next.slice(0, 50);
    void saveValue(COMMENTS_KEY, JSON.stringify(all));
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="rise flex max-h-[65%] flex-col rounded-t-3xl bg-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold">ความคิดเห็น {fmt(clip.cloud ? remote.length : clip.comments + mine.length)}</p>
          <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-8 place-items-center text-muted">
            <CloseIcon size={18} />
          </button>
        </div>
        <ul className="no-scrollbar flex-1 overflow-y-auto px-4 py-2">
          {remote.map((c) => (
            <Comment key={c.id} name={c.profiles?.handle ?? "ผู้ใช้"} text={c.body} />
          ))}
          {mine.map((c) => (
            <Comment key={c.at} name="คุณ" text={c.text} />
          ))}
          {seeded.map(([name, t]) => (
            <Comment key={name} name={name} text={t} />
          ))}
          {remote.length + mine.length + seeded.length === 0 ? <p className="py-6 text-center text-sm text-muted">ยังไม่มีความคิดเห็น</p> : null}
        </ul>
        <div className="safe-bottom flex items-center gap-2 border-t border-line px-3 py-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void send()}
            placeholder="เขียนความคิดเห็น…"
            className="h-10 flex-1 rounded-full bg-subtle px-4 text-sm text-fg outline-none placeholder:text-faint"
          />
          <button type="button" onClick={() => void send()} aria-label="ส่ง" className="grid size-10 place-items-center rounded-full bg-gold-grad text-accent-fg">
            <SendIcon size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Comment({ name, text }: { name: string; text: string }) {
  const [a, b] = hashPalette(name);
  return (
    <li className="flex gap-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold" style={{ background: `linear-gradient(140deg, ${a}, ${b})` }}>
        {name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">{name}</p>
        <p className="text-sm text-fg">{text}</p>
      </div>
    </li>
  );
}

function UploadSheet({ file, onClose, onPosted }: { file: File; onClose: () => void; onPosted: (clip: Clip) => void }) {
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const session = useAuth((s) => s.session);
  const [publicPost, setPublicPost] = useState(cloudEnabled);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function post() {
    if (publicPost && !session) return askSignIn("เข้าสู่ระบบเพื่อโพสต์คลิปให้ทุกคนเห็น");
    setBusy(true);
    try {
      onPosted(publicPost ? await uploadCloudClip(file, caption) : await addMyClip(file, caption));
    } catch (e) {
      useApp.getState().toast(e instanceof Error ? e.message : "บันทึกคลิปไม่ได้");
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-bg">
      <div className="safe-top flex items-center justify-between px-4 pb-2">
        <button type="button" onClick={onClose} aria-label="ยกเลิก" className="grid size-10 place-items-center text-fg">
          <CloseIcon size={22} />
        </button>
        <p className="text-base font-semibold">คลิปใหม่</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void post()}
          className="h-9 rounded-full bg-gold-grad px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
        >
          {busy ? (publicPost ? "กำลังอัปโหลด…" : "กำลังบันทึก…") : "โพสต์"}
        </button>
      </div>
      <div className="relative mx-auto aspect-[9/16] h-[55%] overflow-hidden rounded-2xl bg-black">
        {preview ? <video src={preview} className="h-full w-full object-cover" autoPlay muted loop playsInline /> : null}
      </div>
      <div className="px-4 pt-4">
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={220}
          rows={3}
          placeholder="เขียนคำบรรยาย… #แฮชแท็ก"
          className="w-full resize-none rounded-xl bg-subtle p-3 text-sm text-fg outline-none placeholder:text-faint focus:ring-2 focus:ring-gold"
        />
        {cloudEnabled ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPublicPost(true)}
              className={cn("flex h-11 items-center justify-center gap-2 rounded-xl text-sm", publicPost ? "bg-gold-grad text-accent-fg" : "bg-subtle text-muted ring-gold")}
            >
              <GlobeIcon size={16} /> สาธารณะ
            </button>
            <button
              type="button"
              onClick={() => setPublicPost(false)}
              className={cn("h-11 rounded-xl text-sm", !publicPost ? "bg-gold-grad text-accent-fg" : "bg-subtle text-muted ring-gold")}
            >
              เก็บในเครื่อง
            </button>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-faint">
          {publicPost
            ? "ทุกคนที่ใช้ Do.T จะเห็นคลิปนี้ (ไม่เกิน 50 MB) — โปรดโพสต์เฉพาะคลิปที่คุณเป็นเจ้าของ"
            : "คลิปเก็บไว้ในเครื่องนี้เท่านั้น ไม่ได้อัปโหลด"}
        </p>
      </div>
    </div>
  );
}
