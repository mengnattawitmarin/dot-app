import { mark, stationFreq, type Station, type StudioPreset, type TvChannel } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { MoonIcon, MusicIcon } from "@/components/icons";

/**
 * Generated artwork for stations and channels — original designs, no broadcaster logos.
 * Each id hashes to a stable palette so a station always looks the same.
 */
const PALETTES: Array<[string, string, string]> = [
  ["#f2d38f", "#b07a2a", "#2a1a06"], // gold
  ["#ff8a7a", "#b3262e", "#2a0709"], // crimson
  ["#7fe3d4", "#16808a", "#04191c"], // teal
  ["#c7a3ff", "#5b2fb0", "#140829"], // violet
  ["#9be38f", "#2f8a3a", "#071a09"], // emerald
  ["#8fc3ff", "#2856b3", "#060f26"], // sapphire
  ["#ffc27a", "#c4611d", "#2a1205"], // amber
  ["#ffa3cf", "#b02f76", "#28061a"], // rose
];

export const STUDIO_PALETTE: Record<StudioPreset, [string, string, string]> = {
  "night-drive": ["#b9a3ff", "#3b2a5e", "#120c1f"],
  loft: ["#ffc590", "#6a3d1e", "#1a0e06"],
  focus: ["#93d9ee", "#1f4553", "#071317"],
  club: ["#ff9ad8", "#5a1f45", "#170711"],
  after: ["#f2d38f", "#4d3a1a", "#140f06"],
  rain: ["#a9c6ee", "#25384f", "#080c12"],
};

export function hashPalette(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTES[h % PALETTES.length]!;
}

function Grain({ id }: { id: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-25 mix-blend-overlay" aria-hidden="true">
      <filter id={`g-${id}`}>
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#g-${id})`} />
    </svg>
  );
}

const SIZE = {
  sm: { big: "text-[19px]", small: "text-[8px]", pad: "p-1.5", icon: 20 },
  md: { big: "text-[15px]", small: "text-[7px]", pad: "p-1", icon: 16 },
  lg: { big: "text-6xl", small: "text-sm", pad: "p-5", icon: 64 },
} as const;

export function StationArt({
  station,
  size = "sm",
  className,
}: {
  station: Station;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const [light, mid, dark] = station.kind === "studio" ? STUDIO_PALETTE[station.preset] : hashPalette(station.id);
  const freq = stationFreq(station);
  const sz = SIZE[size];
  const safeId = station.id.replace(/[^a-z0-9-]/gi, "");
  const [whole, decimal] = (freq ?? "").split(".");

  return (
    <span
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-xl", sz.pad, className)}
      style={{ background: `radial-gradient(120% 90% at 20% 10%, ${mid}, ${dark} 75%)` }}
      aria-hidden="true"
    >
      {/* radio waves */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {[22, 38, 54, 70].map((r, i) => (
          <circle key={r} cx="92" cy="92" r={r} fill="none" stroke={light} strokeOpacity={0.28 - i * 0.05} strokeWidth="2.5" />
        ))}
      </svg>
      <Grain id={safeId} />
      {station.kind === "studio" ? (
        <span className="relative flex flex-col items-center" style={{ color: light }}>
          {station.preset === "night-drive" || station.preset === "rain" ? (
            <MoonIcon size={sz.icon} />
          ) : (
            <MusicIcon size={sz.icon} />
          )}
        </span>
      ) : freq ? (
        <span className="relative flex flex-col items-center leading-none" style={{ color: light }}>
          <span className={cn("font-display font-bold tracking-tight", sz.big)}>
            {whole}
            {decimal ? <span className="text-[0.55em]">.{decimal}</span> : null}
          </span>
          <span className={cn("mt-0.5 font-semibold tracking-[0.2em] opacity-80", sz.small)}>FM</span>
        </span>
      ) : (
        <span className={cn("relative font-display font-bold", sz.big)} style={{ color: light }}>
          {mark(station.name)}
        </span>
      )}
    </span>
  );
}

function channelLabel(name: string) {
  const ch = name.match(/^ช่อง\s*(\d+)/);
  if (ch) return { big: ch[1]!, small: "ช่อง" };
  const num = name.match(/^(\d+)\s+(.+)$/);
  if (num) return { big: num[1]!, small: num[2]! };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { big: name, small: "" };
  return { big: parts[0]!, small: parts.slice(1).join(" ") };
}

export function ChannelArt({
  channel,
  className,
  size = "md",
}: {
  channel: TvChannel;
  className?: string;
  size?: "sm" | "md";
}) {
  const [light, mid, dark] = hashPalette(channel.id + "tv");
  const { big, small } = channelLabel(channel.name);
  const safeId = channel.id.replace(/[^a-z0-9-]/gi, "");
  const long = big.length > 5;

  return (
    <span
      className={cn("relative grid place-items-center overflow-hidden rounded-xl", className)}
      style={{ background: `linear-gradient(150deg, ${mid}, ${dark} 80%)` }}
      aria-hidden="true"
    >
      {/* screen glow + scanlines */}
      <span
        className="absolute inset-[12%] rounded-lg"
        style={{
          background: `radial-gradient(80% 70% at 50% 40%, ${light}33, transparent 70%)`,
          boxShadow: `inset 0 0 0 1px ${light}40`,
        }}
      />
      <span
        className="absolute inset-0 opacity-20"
        style={{ backgroundImage: `repeating-linear-gradient(0deg, ${light}22 0 1px, transparent 1px 3px)` }}
      />
      <Grain id={safeId} />
      {channel.mode === "scene" ? (
        <span className="relative flex flex-col items-center gap-0.5" style={{ color: light }}>
          <MoonIcon size={size === "md" ? 22 : 16} />
          <span className="text-[9px] font-medium opacity-90">ในเครื่อง</span>
        </span>
      ) : (
        <span className="relative flex flex-col items-center px-1 text-center leading-none" style={{ color: light }}>
          <span
            className={cn(
              "font-display font-bold tracking-tight",
              size === "md" ? (long ? "text-[13px]" : "text-2xl") : long ? "text-[10px]" : "text-lg",
            )}
          >
            {big}
          </span>
          {small ? (
            <span className={cn("mt-1 max-w-full truncate font-medium opacity-85", size === "md" ? "text-[9px]" : "text-[7px]")}>
              {small}
            </span>
          ) : null}
        </span>
      )}
      <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full" style={{ background: channel.mode === "video" ? "#e0443a" : light }} />
    </span>
  );
}
