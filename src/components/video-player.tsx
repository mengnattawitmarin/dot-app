import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SceneId } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { SceneCanvas } from "@/components/scene-canvas";
import { CastIcon, ChevronLeft, PlayIcon } from "@/components/icons";
import { LiveBadge } from "@/components/ui";

type HlsLike = { destroy: () => void };
type CastableVideo = HTMLVideoElement & {
  webkitShowPlaybackTargetPicker?: () => void;
  remote?: { prompt: () => Promise<void>; watchAvailability?: (cb: (available: boolean) => void) => Promise<number> };
};

/**
 * Full-screen player shared by live TV and films.
 * HLS uses hls.js where MSE exists (Android WebView) and falls back to native HLS (iOS WKWebView).
 */
export function VideoPlayer({
  name,
  subtitle,
  src,
  hls,
  scene,
  live,
  blocked,
  onClose,
  rail,
}: {
  name: string;
  subtitle: string;
  src?: string;
  hls?: boolean;
  scene?: SceneId;
  live?: boolean;
  blocked?: boolean;
  onClose: () => void;
  rail?: ReactNode;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsLike | null>(null);
  const hlsActive = useRef(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const sceneMode = !src;
  const [canCast, setCanCast] = useState(false);

  useEffect(() => {
    const v = videoRef.current as CastableVideo | null;
    if (!v) return;
    if (v.webkitShowPlaybackTargetPicker) {
      setCanCast(true); // AirPlay (iOS)
      return;
    }
    if (v.remote?.watchAvailability) {
      v.remote
        .watchAvailability((available) => setCanCast(available))
        .catch(() => setCanCast(false)); // Remote Playback (Chromecast in Chrome)
    }
  }, []);

  function cast() {
    const v = videoRef.current as CastableVideo | null;
    if (!v) return;
    if (v.webkitShowPlaybackTargetPicker) v.webkitShowPlaybackTargetPicker();
    else void v.remote?.prompt().catch(() => undefined);
  }

  function destroyHls() {
    hlsActive.current = false;
    hlsRef.current?.destroy();
    hlsRef.current = null;
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || blocked) {
      destroyHls();
      video?.pause();
      return;
    }
    let cancelled = false;
    destroyHls();
    video.removeAttribute("src");
    video.load();
    setFailed(false);
    setNeedsTap(false);
    setLoading(true);

    const playNative = async () => {
      video.src = src;
      try {
        await video.play();
      } catch {
        if (!cancelled) setNeedsTap(true);
      }
    };

    void (async () => {
      const canNativeHls = video.canPlayType("application/vnd.apple.mpegurl") !== "";
      if (hls && !canNativeHls) {
        try {
          const { default: Hls } = await import("hls.js");
          if (cancelled) return;
          if (Hls.isSupported()) {
            const instance = new Hls({ enableWorker: true, lowLatencyMode: Boolean(live) });
            hlsRef.current = instance;
            hlsActive.current = true;
            instance.loadSource(src);
            instance.attachMedia(video);
            instance.on(Hls.Events.MANIFEST_PARSED, () => {
              video.play().then(() => setNeedsTap(false)).catch(() => setNeedsTap(true));
            });
            instance.on(Hls.Events.ERROR, (_e, data) => {
              if (!data.fatal || cancelled) return;
              destroyHls();
              setFailed(true);
              setLoading(false);
            });
            return;
          }
        } catch {
          /* fall through to native playback */
        }
      }
      await playNative();
    })();

    return () => {
      cancelled = true;
      destroyHls();
      video.pause();
    };
  }, [src, hls, live, blocked]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        {sceneMode && scene ? <SceneCanvas scene={scene} className="absolute inset-0" /> : null}
        <video
          ref={videoRef}
          className={cn("absolute inset-0 h-full w-full object-contain", (sceneMode || blocked) && "hidden")}
          playsInline
          x-webkit-airplay="allow"
          controls={!live && !sceneMode}
          onWaiting={() => setLoading(true)}
          onPlaying={() => {
            setLoading(false);
            setNeedsTap(false);
          }}
          onError={() => {
            if (!hlsActive.current && !sceneMode) {
              setFailed(true);
              setLoading(false);
            }
          }}
        />
        <div className="safe-top pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent pb-10">
          <div className="pointer-events-auto flex items-center gap-3 px-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-full bg-black/50 text-fg ring-gold"
              aria-label="ย้อนกลับ"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-base font-semibold text-fg">
                {name} {live ? <LiveBadge /> : null}
              </p>
              <p className="truncate text-xs text-muted">{subtitle}</p>
            </div>
            {canCast && !sceneMode ? (
              <button
                type="button"
                onClick={cast}
                aria-label="ส่งไปทีวี (AirPlay / Cast)"
                className="ml-auto grid size-10 shrink-0 place-items-center rounded-full bg-black/50 text-gold ring-gold"
              >
                <CastIcon size={20} />
              </button>
            ) : null}
          </div>
        </div>
        {needsTap && !sceneMode ? (
          <button
            type="button"
            className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gold-grad text-accent-fg"
            aria-label="เล่น"
            onClick={() => void videoRef.current?.play().catch(() => setNeedsTap(true))}
          >
            <PlayIcon size={26} />
          </button>
        ) : null}
        <div className="absolute inset-x-0 bottom-3 text-center text-sm">
          {blocked ? <p className="text-muted">ต้องใช้อินเทอร์เน็ต</p> : null}
          {loading && !sceneMode && !failed && !blocked && !needsTap ? <p className="text-muted">กำลังเปิดสัญญาณ…</p> : null}
          {failed && !sceneMode ? <p className="text-fg">สัญญาณไม่ตอบตอนนี้ ลองใหม่หรือเลือกช่องอื่น</p> : null}
        </div>
      </div>
      {rail ? <div className="safe-bottom border-t border-line bg-bg">{rail}</div> : null}
    </div>
  );
}
