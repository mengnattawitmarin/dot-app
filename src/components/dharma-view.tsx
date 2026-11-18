import { useEffect, useMemo, useState } from "react";
import {
  formatHours,
  getAlbum,
  getTeacher,
  loadDharma,
  reloadDharma,
  takePending,
  type DharmaTarget,
  teacherMark,
  topicLabel,
  useDharma,
  type DharmaAlbum,
  type Teacher,
} from "@/lib/dharma";
import { continueListening, formatDuration, getShow, useStories, type Show } from "@/lib/stories";
import { CoverImage } from "@/components/stories-view";
import { playEpisode } from "@/lib/episode-player";
import { openExternal } from "@/lib/share";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, ExternalIcon, HeartIcon, LotusIcon, PauseIcon, PlayIcon, SearchIcon } from "@/components/icons";
import { Chip, SectionHeader } from "@/components/ui";

type View = { kind: "home" } | { kind: "teacher"; id: string } | { kind: "album"; showId: string; from?: string };

const SRC_LABEL: Record<string, string> = { archive: "archive.org", podcast: "พอดแคสต์", web: "เว็บไซต์วัด" };

/** Typographic emblem for a teacher — generated art, no photos. */
export function TeacherEmblem({ teacher, className }: { teacher: Pick<Teacher, "name">; className?: string }) {
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full ring-gold", className)}
      style={{ background: "radial-gradient(circle at 30% 25%, var(--color-gold-light), var(--color-gold-deep) 70%)" }}
    >
      <LotusIcon size={60} className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-black/15" />
      <span className="relative text-[1.6em] font-semibold leading-none text-accent-fg">{teacherMark(teacher.name)}</span>
    </span>
  );
}

function AlbumArt({ album, className }: { album: DharmaAlbum; className?: string }) {
  const teacher = getTeacher(album.teacherId);
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-subtle ring-gold", className)}>
      <LotusIcon size={26} className="text-gold/70" />
      {teacher ? <span className="absolute bottom-1 text-[9px] text-muted">{teacherMark(teacher.name)}</span> : null}
      {album.image && !failed ? (
        <img src={album.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

export function DharmaView() {
  const { status, teachers, topics } = useDharma();
  const progress = useStories((s) => s.progress);
  const [view, setView] = useState<View>(() => takePending() ?? { kind: "home" });
  const [topic, setTopic] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadDharma();
    const onOpen = (e: Event) => {
      takePending();
      setView((e as CustomEvent<DharmaTarget>).detail);
    };
    window.addEventListener("dot:open-dharma", onOpen);
    return () => window.removeEventListener("dot:open-dharma", onOpen);
  }, []);

  const resume = useMemo(() => continueListening(progress).filter((x) => x.item.show.id.startsWith("dh-")), [progress, teachers]);

  if (view.kind === "teacher") {
    const teacher = getTeacher(view.id);
    if (teacher) return <TeacherDetail teacher={teacher} onBack={() => setView({ kind: "home" })} onAlbum={(showId) => setView({ kind: "album", showId, from: teacher.id })} />;
  }
  if (view.kind === "album") {
    const album = getAlbum(view.showId);
    if (album)
      return (
        <AlbumDetail
          album={album}
          onBack={() => setView(view.from ? { kind: "teacher", id: view.from } : { kind: "home" })}
          onTeacher={() => setView({ kind: "teacher", id: album.teacherId })}
        />
      );
  }

  const allAlbums = teachers.flatMap((t) => t.albums);
  const usedTopics = topics.filter((t) => allAlbums.some((a) => a.topic === t.id));
  const q = query.trim().toLowerCase();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          type="button"
          onClick={() => useApp.getState().setTab("home")}
          className="grid size-9 place-items-center rounded-full bg-subtle text-gold ring-gold"
          aria-label="กลับหน้าหลัก"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">ธรรมะ</h1>
          <p className="truncate text-[11px] text-muted">ฟังเทศน์ฟรี จากครูบาอาจารย์ที่คนไทยรักและศรัทธา</p>
        </div>
      </div>

      <div className="px-4 pb-3">
        <label className="flex h-10 items-center gap-2 rounded-full bg-subtle px-4 ring-gold">
          <SearchIcon size={16} className="text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาหัวข้อเทศน์ เช่น กรรมฐาน สังโยชน์ ความตาย"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            enterKeyHint="search"
          />
        </label>
      </div>

      {!q ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          <Chip active={topic === "all"} onClick={() => setTopic("all")}>
            ครูบาอาจารย์
          </Chip>
          {usedTopics.map((t) => (
            <Chip key={t.id} active={topic === t.id} onClick={() => setTopic(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {status !== "ready" && teachers.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-sm text-muted">{status === "error" ? "โหลดรายการธรรมะไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่" : "กำลังโหลดธรรมะ…"}</p>
            {status === "error" ? (
              <button type="button" onClick={() => void reloadDharma()} className="mt-4 h-10 rounded-full bg-gold-grad px-5 text-sm font-semibold text-accent-fg">
                ลองใหม่
              </button>
            ) : null}
          </div>
        ) : null}

        {q ? (
          <SearchResults query={q} albums={allAlbums} onAlbum={(showId) => setView({ kind: "album", showId })} />
        ) : topic !== "all" ? (
          <ul className="divide-y divide-line">
            {allAlbums
              .filter((a) => a.topic === topic)
              .map((a) => (
                <li key={a.showId}>
                  <AlbumRow album={a} showTeacher onOpen={() => setView({ kind: "album", showId: a.showId })} />
                </li>
              ))}
          </ul>
        ) : (
          <>
            {resume.length > 0 ? (
              <section className="mb-6">
                <SectionHeader title="ฟังต่อ" />
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                  {resume.map(({ key, p, item }) => (
                    <button key={key} type="button" onClick={() => void playEpisode(key)} className="w-40 shrink-0 rounded-xl bg-elevated p-3 text-left ring-gold">
                      <span className="line-clamp-2 block text-sm leading-snug">{item.episode.title}</span>
                      <span className="mt-1 block truncate text-[11px] text-muted">{item.show.author}</span>
                      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-line">
                        <span className="block h-full bg-gold" style={{ width: `${p.d ? Math.min(100, (p.t / p.d) * 100) : 0}%` }} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <ul className="space-y-3">
              {teachers.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setView({ kind: "teacher", id: t.id })}
                    className="card-sheen flex w-full items-center gap-3 rounded-2xl bg-elevated p-3 text-left ring-gold"
                  >
                    <TeacherEmblem teacher={t} className="size-14 text-base" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{t.name}</span>
                      <span className="block truncate text-[11px] text-gold-light">{t.place}</span>
                      <span className="mt-0.5 line-clamp-1 block text-[11px] text-muted">{t.blurb}</span>
                      <span className="mt-1 block text-[10px] text-faint">
                        {t.albums.length} ชุด · {t.tracks.toLocaleString("th-TH")} ตอน{t.hours ? ` · ${t.hours.toLocaleString("th-TH")} ชั่วโมง` : ""}
                      </span>
                    </span>
                    <ChevronRight size={18} className="text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {teachers.length > 0 ? (
          <p className="mt-6 text-center text-[11px] leading-relaxed text-faint">
            เสียงธรรมทั้งหมดเผยแพร่ฟรีเป็นธรรมทาน โดยวัด คณะศิษย์ และผู้เผยแพร่แต่ละราย · เล่นตรงจากแหล่งที่มา · อัปเดตทุกวัน
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AlbumRow({ album, onOpen, showTeacher = false }: { album: DharmaAlbum; onOpen: () => void; showTeacher?: boolean }) {
  const teacher = showTeacher ? getTeacher(album.teacherId) : undefined;
  const meta = [
    teacher?.name,
    album.year ? `พ.ศ. ${album.year}` : "",
    `${album.n} ตอน`,
    formatHours(album.dur),
    SRC_LABEL[album.src],
  ].filter(Boolean);
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 py-3 text-left">
      <AlbumArt album={album} className="size-12" />
      <span className="min-w-0 flex-1">
        {album.group ? <span className="block truncate text-[10px] text-gold-light">{album.group}</span> : null}
        <span className="line-clamp-2 block text-sm leading-snug">{album.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-faint">{meta.join(" · ")}</span>
      </span>
      <ChevronRight size={16} className="text-faint" />
    </button>
  );
}

function TeacherDetail({ teacher, onBack, onAlbum }: { teacher: Teacher; onBack: () => void; onAlbum: (showId: string) => void }) {
  const topics = useDharma((s) => s.topics).filter((t) => teacher.albums.some((a) => a.topic === t.id));
  const [topic, setTopic] = useState("all");
  const favorites = useApp((s) => s.favorites);
  const followed = teacher.albums.filter((a) => favorites.includes(a.showId));
  const shown = topic === "all" ? topics : topics.filter((t) => t.id === topic);

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-6">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-gold" aria-label="กลับ">
        <ChevronLeft size={18} /> ธรรมะ
      </button>
      <div className="flex items-center gap-4">
        <TeacherEmblem teacher={teacher} className="size-20 text-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-snug">{teacher.full}</h1>
          <p className="mt-0.5 text-xs text-gold-light">{teacher.place}</p>
          <p className="mt-1 text-[11px] text-faint">
            {teacher.albums.length} ชุด · {teacher.tracks.toLocaleString("th-TH")} ตอน{teacher.hours ? ` · ${teacher.hours.toLocaleString("th-TH")} ชั่วโมง` : ""}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">{teacher.blurb}</p>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={topic === "all"} onClick={() => setTopic("all")}>
          ทุกหมวด
        </Chip>
        {topics.map((t) => (
          <Chip key={t.id} active={topic === t.id} onClick={() => setTopic(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>

      {topic === "all" && followed.length > 0 ? (
        <section className="mt-5">
          <h2 className="text-xs text-faint">ชุดที่ติดตาม</h2>
          <ul className="divide-y divide-line">
            {followed.map((a) => (
              <li key={a.showId}>
                <AlbumRow album={a} onOpen={() => onAlbum(a.showId)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {shown.map((t) => {
        const list = teacher.albums.filter((a) => a.topic === t.id);
        return (
          <section key={t.id} className="mt-5">
            <h2 className="flex items-baseline justify-between text-[15px] font-semibold">
              {t.label}
              <span className="text-[11px] font-normal text-faint">{list.length} ชุด</span>
            </h2>
            <ul className="divide-y divide-line">
              {list.map((a) => (
                <li key={a.showId}>
                  <AlbumRow album={a} onOpen={() => onAlbum(a.showId)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function AlbumDetail({ album, onBack, onTeacher }: { album: DharmaAlbum; onBack: () => void; onTeacher: () => void }) {
  const show = getShow(album.showId);
  const teacher = getTeacher(album.teacherId);
  const favorites = useApp((s) => s.favorites);
  const nowId = useApp((s) => (s.now?.kind === "episode" ? s.now.id : null));
  const playing = useApp((s) => s.playing && s.output === "radio");
  const progress = useStories((s) => s.progress);
  const [more, setMore] = useState(false);
  if (!show) return null;
  const followed = favorites.includes(album.showId);
  // Resume where you stopped in this album, else start from the first talk.
  const resumeKey =
    show.episodes
      .map((e) => `${show.id}:${e.id}`)
      .find((k) => {
        const p = progress[k];
        return p && p.t > 20 && (!p.d || p.t < p.d - 30);
      }) ?? `${show.id}:${show.episodes[0]!.id}`;
  const resuming = resumeKey !== `${show.id}:${show.episodes[0]!.id}` || Boolean(progress[resumeKey]?.t);

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-6">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-sm text-gold" aria-label="กลับ">
        <ChevronLeft size={18} /> {teacher?.name ?? "ธรรมะ"}
      </button>
      <div className="flex gap-4">
        <AlbumArt album={album} className="size-28" />
        <div className="min-w-0 flex-1">
          {album.group ? <p className="line-clamp-2 text-[11px] text-gold-light">{album.group}</p> : null}
          <h1 className="line-clamp-3 text-lg font-semibold leading-snug">{album.title}</h1>
          <button type="button" onClick={onTeacher} className="mt-1 block truncate text-xs text-muted">
            {teacher?.name}
          </button>
          <p className="mt-1 text-[11px] text-faint">
            {[topicLabel(album.topic), album.year ? `พ.ศ. ${album.year}` : "", `${show.episodes.length} ตอน`, formatHours(album.dur)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => void playEpisode(resumeKey)}
          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-gold-grad text-sm font-semibold text-accent-fg"
        >
          <PlayIcon size={14} /> {resuming ? "ฟังต่อ" : "เล่นทั้งชุด"}
        </button>
        <button
          type="button"
          onClick={() => useApp.getState().toggleFavorite(album.showId)}
          aria-pressed={followed}
          className={cn("flex h-10 items-center gap-1.5 rounded-full bg-subtle px-4 text-sm ring-gold", followed ? "text-gold" : "text-muted")}
        >
          <HeartIcon size={16} filled={followed} /> {followed ? "ติดตามแล้ว" : "ติดตาม"}
        </button>
      </div>
      {album.desc ? (
        <button type="button" onClick={() => setMore((v) => !v)} className="mt-4 block text-left">
          <p className={more ? "whitespace-pre-line text-sm text-muted" : "line-clamp-3 text-sm text-muted"}>{album.desc}</p>
        </button>
      ) : null}

      <ul className="mt-4 divide-y divide-line">
        {show.episodes.map((ep, i) => {
          const key = `${show.id}:${ep.id}`;
          const current = key === nowId;
          const p = progress[key];
          const pct = p?.d ? Math.min(100, (p.t / p.d) * 100) : 0;
          return (
            <li key={ep.id}>
              <button type="button" onClick={() => void playEpisode(key)} className="flex w-full items-center gap-3 py-3 text-left">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-xs", current ? "bg-gold-grad text-accent-fg" : "bg-subtle text-gold ring-gold")}>
                  {current ? playing ? <PauseIcon size={14} /> : <PlayIcon size={14} className="translate-x-px" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("line-clamp-2 block text-sm leading-snug", current && "text-gold-light")}>{ep.title}</span>
                  <span className="mt-0.5 block text-[11px] text-faint">
                    {[formatDuration(ep.duration), pct >= 97 ? "ฟังจบแล้ว" : pct > 0 ? `ฟังไป ${Math.round(pct)}%` : ""].filter(Boolean).join(" · ")}
                  </span>
                  {pct > 0 && pct < 97 ? (
                    <span className="mt-1 block h-0.5 overflow-hidden rounded-full bg-line">
                      <span className="block h-full bg-gold" style={{ width: `${pct}%` }} />
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {album.link ? (
        <button type="button" onClick={() => openExternal(album.link)} className="mt-4 flex items-center gap-1.5 text-xs text-faint">
          <ExternalIcon size={14} /> ที่มา: {SRC_LABEL[album.src] ?? "ต้นฉบับ"}
        </button>
      ) : null}
    </div>
  );
}

function SearchResults({ query, albums, onAlbum }: { query: string; albums: DharmaAlbum[]; onAlbum: (showId: string) => void }) {
  const results = useMemo(() => {
    const words = query.split(/\s+/).filter(Boolean);
    const hit = (s: string) => {
      const t = s.toLowerCase();
      return words.every((w) => t.includes(w));
    };
    const albumHits = albums.filter((a) => hit(`${a.group ?? ""} ${a.title} ${getTeacher(a.teacherId)?.name ?? ""}`)).slice(0, 30);
    const tracks: Array<{ key: string; title: string; album: DharmaAlbum }> = [];
    for (const a of albums) {
      const show = getShow(a.showId);
      if (!show) continue;
      for (const e of show.episodes) {
        if (tracks.length >= 60) break;
        if (hit(e.title)) tracks.push({ key: `${show.id}:${e.id}`, title: e.title, album: a });
      }
    }
    return { albumHits, tracks };
  }, [query, albums]);

  if (!results.albumHits.length && !results.tracks.length) return <p className="mt-10 text-center text-sm text-muted">ไม่พบ “{query}”</p>;
  return (
    <>
      {results.albumHits.length ? (
        <section className="mb-5">
          <h2 className="text-xs text-faint">ชุดเทศน์</h2>
          <ul className="divide-y divide-line">
            {results.albumHits.map((a) => (
              <li key={a.showId}>
                <AlbumRow album={a} showTeacher onOpen={() => onAlbum(a.showId)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {results.tracks.length ? (
        <section>
          <h2 className="text-xs text-faint">ตอน</h2>
          <ul className="divide-y divide-line">
            {results.tracks.map((r) => (
              <li key={r.key}>
                <button type="button" onClick={() => void playEpisode(r.key)} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-subtle text-gold ring-gold">
                    <PlayIcon size={14} className="translate-x-px" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-sm leading-snug">{r.title}</span>
                    <span className="block truncate text-[11px] text-faint">
                      {getTeacher(r.album.teacherId)?.name} · {r.album.title}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/** Cover for any episode: dharma talks get a lotus emblem (gold), other shows their podcast art. */
export function EpisodeCover({ show, image, className }: { show: Show; image?: string; className?: string }) {
  if (!show.id.startsWith("dh-") || image || show.image) return <CoverImage src={image || show.image} name={show.name} className={className} />;
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-xl", className)}
      style={{ background: "radial-gradient(circle at 30% 20%, var(--color-gold-light), var(--color-gold-deep) 75%)" }}
    >
      <LotusIcon className="h-1/2 w-1/2 text-accent-fg/80" />
      <span className="absolute bottom-[8%] text-[min(0.9rem,12%)] font-semibold text-accent-fg/80">{teacherMark(show.author)}</span>
    </span>
  );
}
