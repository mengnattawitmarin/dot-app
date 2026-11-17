import { useEffect, useRef, useState } from "react";
import { BookmarkIcon, CopyIcon, HeartIcon, VolumeIcon } from "@/components/icons";
import { reels } from "@/lib/catalog";
import { pauseRadio } from "@/lib/player";
import { selectOffline, useApp } from "@/lib/store";
import { SceneCanvas } from "@/components/scene-canvas";

export function ReelsView({ active }: { active: boolean }) {
  const offline = useApp(selectOffline);
  const liked = useApp((state) => state.liked);
  const favorites = useApp((state) => state.favorites);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const [activeId, setActiveId] = useState(reels[0]?.id ?? "");
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.65) continue;
          const id = (entry.target as HTMLElement).dataset.reel;
          if (id) setActiveId(id);
        }
      },
      { root, threshold: [0.65] },
    );
    root.querySelectorAll<HTMLElement>("[data-reel]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setMuted(true);
  }, [activeId]);

  useEffect(() => {
    videos.current.forEach((video, id) => {
      if (active && id === activeId) {
        video.muted = muted;
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [active, activeId, muted, offline]);

  async function copyThought(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      useApp.getState().toast("คัดลอกความคิดแล้ว");
    } catch {
      useApp.getState().toast("คัดลอกไม่ได้ในเบราว์เซอร์นี้");
    }
  }

  return (
    <div ref={scrollerRef} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain">
      {reels.map((reel) => {
        const showVideo = !offline && Boolean(reel.src);
        const saved = favorites.includes(reel.id);
        const hearted = liked.includes(reel.id);
        return (
          <article key={reel.id} data-reel={reel.id} className="relative h-full snap-start snap-always bg-bg">
            {showVideo ? (
              <video
                ref={(node) => {
                  if (node) videos.current.set(reel.id, node);
                  else videos.current.delete(reel.id);
                }}
                src={reel.src}
                className="absolute inset-0 h-full w-full object-cover"
                playsInline
                muted
                loop
                preload="metadata"
              />
            ) : (
              <SceneCanvas scene={reel.scene} className="absolute inset-0" />
            )}
            <div className="absolute inset-x-0 bottom-0 p-4 pr-16">
              <div className="rounded-xl bg-black/55 p-4 backdrop-blur-sm ring-gold">
                <p className="text-lg font-semibold leading-snug text-fg">{reel.thought}</p>
                <p className="mt-2 text-xs text-gold-light">@{reel.author}</p>
              </div>
            </div>
            <div className="absolute bottom-6 right-2 flex flex-col gap-1">
              <button
                type="button"
                aria-label={hearted ? "เลิกถูกใจ" : "ถูกใจ"}
                aria-pressed={hearted}
                onClick={() => useApp.getState().toggleLike(reel.id)}
                className="grid size-11 place-items-center text-fg"
              >
                <HeartIcon size={24} filled={hearted} className={hearted ? "text-gold" : ""} />
                <span className="sr-only">ถูกใจ</span>
              </button>
              <span className="text-center text-xs tabular-nums text-muted">{reel.likes + (hearted ? 1 : 0)}</span>
              <button
                type="button"
                aria-label={saved ? "เอาออกจากของฉัน" : "เก็บไว้"}
                aria-pressed={saved}
                onClick={() => useApp.getState().toggleFavorite(reel.id)}
                className="grid size-11 place-items-center text-fg"
              >
                <BookmarkIcon size={24} filled={saved} className={saved ? "text-gold" : ""} />
              </button>
              <button
                type="button"
                aria-label={muted ? "เปิดเสียงคลิป" : "ปิดเสียงคลิป"}
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  if (!next && showVideo) pauseRadio();
                }}
                className="grid size-11 place-items-center text-fg"
              >
                <VolumeIcon size={24} muted={muted || !showVideo} />
              </button>
              <button
                type="button"
                aria-label="คัดลอกข้อความ"
                onClick={() => void copyThought(reel.thought)}
                className="grid size-11 place-items-center text-fg"
              >
                <CopyIcon size={22} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
