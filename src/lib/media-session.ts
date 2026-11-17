import { getStation, stationQueue } from "@/lib/catalog";
import { pauseRadio, stepStation, toggleRadio } from "@/lib/player";
import { selectOffline, useApp } from "@/lib/store";

/**
 * Lock-screen / notification / Control Center controls via the Media Session API.
 * Works for live streams (they play through an <audio> element) on Android WebView
 * and iOS WKWebView. Offline studio stations are synthesized with Web Audio, which
 * the OS does not surface on the lock screen.
 */
export function setupMediaSession() {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  const artwork = [
    { src: new URL("./apple-touch-icon.png", document.baseURI).href, sizes: "180x180", type: "image/png" },
  ];

  const safe = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      ms.setActionHandler(action, handler);
    } catch {
      /* action not supported on this platform */
    }
  };
  const queue = () => stationQueue(selectOffline(useApp.getState()));
  safe("play", () => void toggleRadio());
  safe("pause", () => pauseRadio());
  safe("stop", () => pauseRadio());
  safe("previoustrack", () => void stepStation(-1, queue()));
  safe("nexttrack", () => void stepStation(1, queue()));

  let lastId: string | null = null;
  const sync = () => {
    const s = useApp.getState();
    const station = s.now ? getStation(s.now.id) : undefined;
    if (!station) {
      ms.playbackState = "none";
      return;
    }
    if (station.id !== lastId) {
      lastId = station.id;
      ms.metadata = new MediaMetadata({
        title: station.name,
        artist: station.kind === "live" ? `${station.city} · สด` : "Do.T สตูดิโอในเครื่อง",
        album: "Do.T RADIO",
        artwork,
      });
    }
    ms.playbackState = s.playing && s.output === "radio" ? "playing" : "paused";
  };
  useApp.subscribe(sync);
  sync();
}
