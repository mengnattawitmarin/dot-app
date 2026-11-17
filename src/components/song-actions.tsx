import { useState } from "react";
import { createPortal } from "react-dom";
import type { Station } from "@/lib/catalog";
import { songLinks } from "@/lib/song-links";
import { openExternal, shareContent, stationLink } from "@/lib/share";
import { cn } from "@/lib/cn";
import { StationArt } from "@/components/art";
import { CloseIcon, ExternalIcon, MusicIcon, ShareIcon } from "@/components/icons";

type Song = { title: string; artist: string } | null;

export function shareStation(station: Station, song: Song) {
  const text = song
    ? `🎵 ${song.title}${song.artist ? ` — ${song.artist}` : ""}\nกำลังเล่นทาง ${station.name} บน Do.T`
    : `📻 กำลังฟัง ${station.name} บน Do.T`;
  void shareContent({ title: "Do.T", text, url: stationLink(station.id) });
}

/** "Open in…" + "Share" buttons for the current song/station, with a platform picker sheet. */
export function SongActions({ station, song, compact = false }: { station: Station; song: Song; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const links = song ? songLinks(song.title, song.artist) : [];

  return (
    <>
      <div className={cn("flex gap-2", compact ? "" : "mt-3 justify-center")}>
        {song ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-full bg-gold-grad font-semibold text-accent-fg",
              compact ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
            )}
          >
            <ExternalIcon size={compact ? 14 : 16} /> เปิดในแอปเพลง
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => shareStation(station, song)}
          aria-label="แชร์"
          className={cn(
            "flex items-center gap-1.5 rounded-full bg-subtle text-gold-light ring-gold",
            compact ? "h-8 px-3 text-xs" : "h-9 px-4 text-sm",
          )}
        >
          <ShareIcon size={compact ? 14 : 16} /> แชร์
        </button>
      </div>

      {open && song
        ? createPortal(
        <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/60" onClick={() => setOpen(false)}>
          <div className="rise safe-bottom mx-auto w-full max-w-lg rounded-t-3xl bg-elevated p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <StationArt station={station} size="md" className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{song.title}</p>
                <p className="truncate text-sm text-muted">{song.artist || station.name}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="ปิด" className="grid size-9 place-items-center text-muted">
                <CloseIcon size={20} />
              </button>
            </div>
            <p className="mt-4 text-xs text-faint">ฟังเพลงนี้เต็ม ๆ ที่…</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {links.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    openExternal(l.url);
                  }}
                  className="flex h-12 items-center gap-2.5 rounded-xl bg-subtle px-3 text-left text-sm ring-gold active:scale-[0.98]"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-bg text-gold">
                    {l.id === "lyrics" ? <span className="text-xs font-bold">Aa</span> : <MusicIcon size={15} />}
                  </span>
                  <span className="truncate text-[13px]">{l.name}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                shareStation(station, song);
              }}
              className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-grad text-sm font-semibold text-accent-fg"
            >
              <ShareIcon size={18} /> แชร์เพลงนี้ให้เพื่อน
            </button>
            <p className="mt-3 text-center text-[11px] text-faint">ค้นหาจากชื่อเพลงที่สถานีส่งมา ผลลัพธ์อาจไม่ตรงทุกครั้ง</p>
          </div>
        </div>,
            // Portal: an animated (transformed) ancestor would otherwise trap position:fixed.
            document.body,
          )
        : null}
    </>
  );
}
