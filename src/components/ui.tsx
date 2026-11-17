import { useEffect, useRef, type ReactNode } from "react";
import { studio } from "@/lib/engine";
import { cn } from "@/lib/cn";
import type { Title } from "@/lib/catalog";
import { ChevronRight, StarIcon } from "@/components/icons";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-bold tracking-tight text-gold-grad", className)}>
      Do<span className="text-gold-grad">.</span>T
    </span>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[17px] font-semibold text-fg">{title}</h2>
      {onAction ? (
        <button type="button" onClick={onAction} className="flex items-center gap-0.5 text-xs text-muted">
          {action ?? "ดูทั้งหมด"}
          <ChevronRight size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full px-4 text-[13px] font-medium transition-colors",
        active ? "bg-gold-grad text-accent-fg" : "bg-subtle text-muted ring-gold",
      )}
    >
      {children}
    </button>
  );
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-live px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white",
        className,
      )}
    >
      <span className="live-dot size-1.5 rounded-full bg-white" />
      LIVE
    </span>
  );
}

/** Symmetric gold waveform. Studio stations use real analyser levels; live streams are animated. */
export function Waveform({
  active,
  live,
  bars = 44,
  height = 44,
  className,
}: {
  active: boolean;
  live: boolean;
  bars?: number;
  height?: number;
  className?: string;
}) {
  const refs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const idle = (i: number) => 0.18 + 0.22 * Math.abs(Math.sin(i * 0.7)) * Math.abs(Math.cos(i * 0.23));
    const paint = (levels: number[]) => {
      refs.current.forEach((bar, i) => {
        if (bar) bar.style.transform = `scaleY(${Math.max(0.08, Math.min(1, levels[i] ?? 0.1))})`;
      });
    };
    if (!active || reduce) {
      paint(Array.from({ length: bars }, (_, i) => idle(i)));
      return;
    }
    let frame = 0;
    let last = 0;
    const loop = (time: number) => {
      if (time - last > 50) {
        last = time;
        let levels: number[];
        if (live) {
          levels = Array.from({ length: bars }, (_, i) => {
            const center = 1 - Math.abs(i - bars / 2) / (bars / 2);
            return 0.15 + center * 0.55 * Math.abs(Math.sin(time / 210 + i * 0.6)) + Math.random() * 0.2;
          });
        } else {
          const raw = studio.getLevels();
          levels = Array.from({ length: bars }, (_, i) => {
            const v = raw[i % raw.length] ?? 0.1;
            const center = 1 - Math.abs(i - bars / 2) / (bars / 2);
            return 0.12 + v * (0.5 + center * 0.6);
          });
        }
        paint(levels);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [active, live, bars]);

  return (
    <div className={cn("flex items-center justify-between gap-[2px]", className)} style={{ height }} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          ref={(node) => {
            refs.current[i] = node;
          }}
          className="block w-[2px] rounded-full bg-gold transition-transform duration-75"
          style={{ height, transform: "scaleY(0.2)" }}
        />
      ))}
    </div>
  );
}

/** Generated poster art: gradient + grain + title lockup. No third-party key art. */
export function Poster({
  title,
  className,
  size = "md",
  showRating = false,
  children,
}: {
  title: Title;
  className?: string;
  size?: "sm" | "md" | "lg";
  showRating?: boolean;
  children?: ReactNode;
}) {
  const [a, b] = title.palette;
  const words = title.name.split(" ");
  return (
    <div
      className={cn("relative overflow-hidden rounded-xl", className)}
      style={{
        background: `radial-gradient(120% 70% at 70% 15%, ${a}, transparent 70%), linear-gradient(180deg, ${a} 0%, ${b} 85%)`,
      }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-30 mix-blend-overlay" aria-hidden="true">
        <filter id={`grain-${title.id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${title.id})`} />
      </svg>
      <PosterArt title={title} />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 to-transparent" />
      <div className="absolute right-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold tracking-widest text-gold-light">
        Do.T {title.kind === "short" ? "SHORT" : "FILM"}
      </div>
      <div className={cn("absolute inset-x-0 bottom-0", size === "lg" ? "p-4" : "p-2.5")}>
        <p
          className={cn(
            "font-display font-bold uppercase leading-[0.92] tracking-tight text-gold-grad",
            size === "lg" ? "text-4xl" : size === "md" ? "text-xl" : "text-base",
          )}
        >
          {words.map((w, i) => (
            <span key={i} className="block">
              {w}
            </span>
          ))}
        </p>
        {showRating ? (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-gold-light">
            <StarIcon size={11} /> {title.rating.toFixed(1)}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/** Deterministic landscape motif: glowing orb + layered ridges in the title's palette. */
function PosterArt({ title }: { title: Title }) {
  const seed = [...title.id].reduce((n, c) => n + c.charCodeAt(0), 0);
  const ox = 30 + (seed % 45);
  const oy = 22 + (seed % 17);
  const ridge = (base: number, amp: number, k: number) => {
    let d = `M0 ${base}`;
    for (let x = 0; x <= 100; x += 10) d += ` L${x} ${base - amp * Math.abs(Math.sin((x + seed * k) / 13))}`;
    return `${d} L100 100 L0 100 Z`;
  };
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id={`orb-${title.id}`}>
          <stop offset="0%" stopColor="#f6dc9c" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#d6a856" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#d6a856" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={ox} cy={oy} rx="26" ry="20" fill={`url(#orb-${title.id})`} />
      <path d={ridge(66, 16, 3)} fill={title.palette[0]} opacity="0.55" />
      <path d={ridge(78, 12, 7)} fill={title.palette[1]} opacity="0.85" />
    </svg>
  );
}

/** Night skyline with lit windows — hero art for live TV. */
export function Skyline({ className }: { className?: string }) {
  const buildings = Array.from({ length: 16 }, (_, i) => {
    const w = 5 + ((i * 7) % 5);
    const h = 22 + ((i * 37) % 48);
    return { x: i * 6.4, w, h };
  });
  return (
    <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d1424" />
          <stop offset="70%" stopColor="#2a2131" />
          <stop offset="100%" stopColor="#5a3b1f" />
        </linearGradient>
      </defs>
      <rect width="100" height="70" fill="url(#sky)" />
      {Array.from({ length: 24 }, (_, i) => (
        <circle key={i} cx={(i * 41) % 100} cy={(i * 13) % 30} r="0.25" fill="#f6f0e3" opacity="0.6" />
      ))}
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={70 - b.h} width={b.w} height={b.h} fill="#0b0a08" />
          {Array.from({ length: Math.floor(b.h / 4) }, (_, r) =>
            Array.from({ length: Math.floor(b.w / 2) }, (_, c) =>
              (i + r * 3 + c * 5) % 4 === 0 ? (
                <rect key={`${r}-${c}`} x={b.x + 0.8 + c * 2} y={70 - b.h + 2 + r * 4} width="0.9" height="1.4" fill="#f2d38f" opacity="0.85" />
              ) : null,
            ),
          )}
        </g>
      ))}
    </svg>
  );
}
