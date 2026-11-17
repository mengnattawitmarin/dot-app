import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 22, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...rest,
  };
}

export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.5 10.5 12 3.8l8.5 6.7V20a1 1 0 0 1-1 1h-4.8v-6.2H9.3V21H4.5a1 1 0 0 1-1-1z" />
  </svg>
);

export const RadioIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="8" width="18" height="12.5" rx="2.2" />
    <path d="M7 8 16.5 3.5" />
    <circle cx="15.5" cy="14.2" r="2.6" />
    <path d="M6.5 12.5h4M6.5 15.5h4" />
  </svg>
);

export const TvIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="2.8" y="4.5" width="18.4" height="12.5" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

export const FilmIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 9.5h16V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="m4 9.5-.6-3.2a1 1 0 0 1 .8-1.2l13.6-2.5a1 1 0 0 1 1.2.8l.5 2.6z" />
    <path d="m8.2 4.6 2.3 3.4M13.2 3.7l2.3 3.4" />
    <path d="m10.5 13 4 2.3-4 2.3z" fill="currentColor" stroke="none" />
  </svg>
);

export const MusicIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 18V5.5l11-2v12.5" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="17.5" cy="16" r="2.5" />
  </svg>
);

export const SmileIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.3 14.2a4.6 4.6 0 0 0 7.4 0" />
    <path d="M9 9.6h.01M15 9.6h.01" strokeWidth={2.4} />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.8" />
    <path d="m20.5 20.5-4.6-4.6" />
  </svg>
);

export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const BellIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </svg>
);

export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.7-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2z" />
  </svg>
);

export const PauseIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <rect x="6.5" y="5" width="3.8" height="14" rx="1" />
    <rect x="13.7" y="5" width="3.8" height="14" rx="1" />
  </svg>
);

export const ChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 5.5 6.5 6.5L9 18.5" />
  </svg>
);

export const ChevronLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 5.5 8.5 12l6.5 6.5" />
  </svg>
);

export const ChevronDown = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m5.5 9 6.5 6.5L18.5 9" />
  </svg>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? "currentColor" : "none"}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
  </svg>
);

export const BookmarkIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? "currentColor" : "none"}>
    <path d="M6.5 3.5h11v17L12 16.8l-5.5 3.7z" />
  </svg>
);

export const SkipBack = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M18.5 5.5v13L9 12z" />
    <path d="M5.5 5.5v13" fill="none" strokeWidth={2} />
  </svg>
);

export const SkipForward = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor">
    <path d="M5.5 5.5v13L15 12z" />
    <path d="M18.5 5.5v13" fill="none" strokeWidth={2} />
  </svg>
);

export const VolumeIcon = ({ muted, ...p }: IconProps & { muted?: boolean }) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {muted ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
  </svg>
);

export const CopyIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
    <path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5" />
  </svg>
);

export const MoonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
  </svg>
);

export const WifiOffIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.3-2.4M19 12.6a10 10 0 0 0-2.3-1.6M2 9a15 15 0 0 1 4.5-2.8M22 9a15 15 0 0 0-9.4-3.9" />
    <path d="M12 20h.01" strokeWidth={2.6} />
  </svg>
);

export const StarIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8z" />
  </svg>
);

export const WaveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12h1.5M6.5 8.5v7M10 5v14M13.5 8v8M17 10v4M20.5 11.5v1" />
  </svg>
);

export const GridIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </svg>
);

export const CastIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 8V6a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M3 12a8 8 0 0 1 8 8M3 16a4 4 0 0 1 4 4" />
    <path d="M3 20h.01" strokeWidth={2.6} />
  </svg>
);

export const ShareIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5v11M7.5 8 12 3.5 16.5 8" />
    <path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5" />
  </svg>
);

export const ClipIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M3.5 8.5h17M8 3.8l2.6 4.7M13.4 3.8 16 8.5" />
    <path d="m10.3 11.6 4.3 2.6-4.3 2.6z" fill="currentColor" stroke="none" />
  </svg>
);

export const CommentIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 11.5a7.5 7 0 1 1 3.4 5.9L4 18.8l1-3.4A6.8 6.8 0 0 1 4 11.5z" />
  </svg>
);

export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const SendIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4z" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const MoreIcon = (p: IconProps) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="5.5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="18.5" cy="12" r="1.8" />
  </svg>
);

export const GlobeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5z" />
  </svg>
);

export const ExternalIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13" />
    <path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" />
  </svg>
);

export const HeadphonesIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
    <rect x="3.5" y="13.5" width="4.5" height="7" rx="1.6" />
    <rect x="16" y="13.5" width="4.5" height="7" rx="1.6" />
  </svg>
);

export const ScissorsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="6" cy="6.5" r="2.6" />
    <circle cx="6" cy="17.5" r="2.6" />
    <path d="M8.2 8 20 18.5M8.2 16 20 5.5" />
  </svg>
);

export const UndoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 7 4.5 11.5 9 16" />
    <path d="M5 11.5h9.5a5 5 0 0 1 0 10H12" />
  </svg>
);

export const RedoIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m15 7 4.5 4.5L15 16" />
    <path d="M19 11.5H9.5a5 5 0 0 0 0 10H12" />
  </svg>
);

export const TextIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 6.5V4.5h14v2M12 4.5v15M9 19.5h6" />
  </svg>
);

export const SparkleIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5 13.8 9 19.5 10.5 13.8 12 12 17.5 10.2 12 4.5 10.5 10.2 9z" />
    <path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </svg>
);

export const SlidersIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </svg>
);

export const CropIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6.5 3v14.5H21M3 6.5h14.5V21" />
  </svg>
);

export const WandIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m4 20 11-11M14 4.5v2M18.5 9.5h2M17 6l1.4-1.4M17 13l1.4 1.4M11 6 9.6 4.6" />
  </svg>
);
