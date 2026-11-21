import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { useDharma } from "@/lib/dharma";

/**
 * Generated emblem for each teacher: his name on a gold medallion, over a faint motif from his
 * monastery. No photos (see AGENTS.md).
 */
type Motif = "vihara" | "forest" | "pond" | "stupa" | "sun" | "mountain" | "sala" | "path" | "garden" | "city";

const MOTIF: Record<string, Motif> = {
  ruesi: "vihara", // วิหารแก้ว วัดท่าซุง
  mahabua: "forest", // วัดป่าบ้านตาด
  jayasaro: "pond", // บ้านบุญ
  buddhadasa: "pond", // สระนาฬิเกร์ สวนโมกข์
  chah: "stupa", // วัดหนองป่าพง
  pramote: "sala",
  paisal: "mountain", // วัดป่าสุคะโต
  jaran: "city",
  vajiramedhi: "sun", // ไร่เชิญตะวัน
  narongsak: "path",
  teean: "path",
  phayom: "garden", // วัดสวนแก้ว
  sompong: "city",
  lee: "stupa",
};

function MotifShape({ motif }: { motif: Motif }) {
  const ink = "rgba(40,26,6,0.4)";
  switch (motif) {
    case "vihara":
      return (
        <g fill={ink}>
          <path d="M50 14 L57 26 L54 26 L62 36 L58 36 L68 48 L32 48 L42 36 L38 36 L46 26 L43 26 Z" />
          <rect x="30" y="48" width="40" height="6" />
          <path d="M22 54 h56 v4 h-56z" />
        </g>
      );
    case "forest":
      return (
        <g fill={ink}>
          <path d="M18 58 L28 26 L38 58Z M34 58 L46 18 L58 58Z M54 58 L66 28 L78 58Z" />
          <path d="M62 50 l8 -6 l8 6 v8 h-16z" />
        </g>
      );
    case "pond":
      return (
        <g fill={ink}>
          <ellipse cx="50" cy="56" rx="34" ry="7" />
          <path d="M22 44 c3 -14 9 -14 12 0 M64 42 c4 -16 10 -16 14 0" stroke={ink} strokeWidth="3" fill="none" />
          <circle cx="28" cy="34" r="7" />
          <circle cx="71" cy="30" r="8" />
        </g>
      );
    case "stupa":
      return (
        <g fill={ink}>
          <path d="M50 10 L52 22 L48 22 Z" />
          <path d="M44 22 h12 l3 8 h-18z" />
          <path d="M38 30 c0 -2 24 -2 24 0 c0 10 -4 16 -12 18 c-8 -2 -12 -8 -12 -18z" />
          <rect x="30" y="48" width="40" height="8" />
        </g>
      );
    case "sun":
      return (
        <g fill={ink}>
          <circle cx="50" cy="40" r="12" />
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (i / 8);
            return <rect key={i} x="49" y="16" width="2" height="7" transform={`rotate(${(a * 180) / Math.PI - 90} 50 40)`} />;
          })}
          <path d="M14 58 c12 -8 24 -8 36 0 c12 -8 24 -8 36 0 v4 h-72z" />
        </g>
      );
    case "mountain":
      return (
        <g fill={ink}>
          <path d="M10 58 L34 22 L46 38 L58 20 L90 58Z" />
          <circle cx="76" cy="22" r="5" />
        </g>
      );
    case "sala":
      return (
        <g fill={ink}>
          <path d="M20 34 L50 16 L80 34 L74 34 L74 38 L26 38 L26 34Z" />
          <rect x="30" y="38" width="4" height="18" />
          <rect x="66" y="38" width="4" height="18" />
          <rect x="22" y="56" width="56" height="4" />
        </g>
      );
    case "path":
      return (
        <g fill={ink}>
          <path d="M44 60 C46 46 54 40 52 24 L56 24 C58 40 50 46 56 60Z" />
          <path d="M14 60 L22 30 L30 60Z M70 60 L78 26 L86 60Z" />
        </g>
      );
    case "garden":
      return (
        <g fill={ink}>
          <circle cx="26" cy="38" r="10" />
          <circle cx="74" cy="36" r="11" />
          <rect x="25" y="46" width="2" height="12" />
          <rect x="73" y="45" width="2" height="13" />
          <path d="M16 58 h68 v3 h-68z" />
        </g>
      );
    case "city":
      return (
        <g fill={ink}>
          <path d="M36 52 L50 22 L64 52Z" />
          <path d="M44 22 L50 10 L56 22Z" />
          <rect x="16" y="40" width="10" height="16" />
          <rect x="74" y="36" width="10" height="20" />
          <rect x="14" y="56" width="72" height="4" />
        </g>
      );
  }
}

const HONORIFICS = ["หลวงพ่อ", "หลวงตา", "หลวงปู่", "พระอาจารย์", "พระมหา", "ท่านพ่อ", "ท่าน", "พระ"];

/** "หลวงพ่อฤาษีลิงดำ" → { honor: "หลวงพ่อ", short: "ฤาษีลิงดำ" } */
export function splitName(name: string) {
  const trimmed = name.trim();
  const honor = HONORIFICS.find((h) => trimmed.startsWith(h)) ?? "";
  let short = trimmed.slice(honor.length).trim().split(/\s+/)[0] ?? trimmed;
  short = short.replace(/ภิกขุ$/, "");
  return { honor, short: short || trimmed };
}

/** Visible width of Thai text (combining vowels/tone marks take no space). */
const visibleLength = (s: string) => s.replace(/[ัิ-ฺ็-๎]/g, "").length;

/** Teacher medallion: the teacher's name set in gold — no photos (see AGENTS.md). */
/** Portraits supplied by the app owner (public/teachers/<id>.jpg). */
const PORTRAITS = new Set([
  "ruesi", "mahabua", "jayasaro", "buddhadasa", "chah", "pramote", "paisal",
  "jaran", "vajiramedhi", "narongsak", "teean", "phayom", "sompong", "lee",
]);

export function TeacherArt(props: { id: string; name?: string; className?: string; rounded?: "full" | "xl" }) {
  const [failed, setFailed] = useState(false);
  const { id, className, rounded = "full" } = props;
  if (PORTRAITS.has(id) && !failed) {
    return (
      <span className={cn("relative block shrink-0 overflow-hidden bg-subtle ring-gold", rounded === "full" ? "rounded-full" : "rounded-xl", className)}>
        <img
          src={`teachers/${id}.jpg`}
          alt={props.name ?? useDharma.getState().teachers.find((t) => t.id === id)?.name ?? ""}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
          style={{ imageRendering: "pixelated" }}
        />
      </span>
    );
  }
  return <NameMedallion {...props} />;
}

function NameMedallion({ id, name, className, rounded = "full" }: { id: string; name?: string; className?: string; rounded?: "full" | "xl" }) {
  const gid = useId().replace(/:/g, "");
  const full = name ?? useDharma.getState().teachers.find((t) => t.id === id)?.name ?? "";
  const { honor, short } = splitName(full);
  const size = Math.min(26, 118 / Math.max(3, visibleLength(short)));
  const motif = MOTIF[id] ?? "stupa";
  return (
    <span className={cn("relative block shrink-0 overflow-hidden ring-gold", rounded === "full" ? "rounded-full" : "rounded-xl", className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full" role="img" aria-label={full}>
        <defs>
          <radialGradient id={`g${gid}`} cx="35%" cy="22%" r="85%">
            <stop offset="0%" stopColor="var(--color-gold-light)" />
            <stop offset="55%" stopColor="var(--color-gold)" />
            <stop offset="100%" stopColor="var(--color-gold-deep)" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#g${gid})`} />
        <g opacity="0.45" transform="translate(0 30)">
          <MotifShape motif={motif} />
        </g>
        <circle cx="50" cy="50" r={rounded === "full" ? 44 : 46} fill="none" stroke="rgba(40,26,6,0.35)" strokeWidth="1.2" />
        {honor ? (
          <text x="50" y={50 - size * 0.62} textAnchor="middle" fontSize="11" fontWeight="500" fill="rgba(30,18,4,0.7)">
            {honor}
          </text>
        ) : null}
        <text x="50" y={honor ? 50 + size * 0.55 : 50 + size * 0.35} textAnchor="middle" fontSize={size} fontWeight="700" fill="#1e1204">
          {short}
        </text>
      </svg>
    </span>
  );
}
