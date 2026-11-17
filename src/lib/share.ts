import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { REMOTE_BASE } from "@/lib/remote";
import { useApp } from "@/lib/store";

const native = Capacitor.isNativePlatform();

/**
 * System share sheet (LINE, Facebook, Messenger, X…). Android WebView has no
 * navigator.share, so native builds go through @capacitor/share.
 */
export async function shareContent({ title, text, url }: { title: string; text: string; url?: string }) {
  try {
    if (native) {
      await Share.share({ title, text, url, dialogTitle: "แชร์ผ่าน" });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
    await navigator.clipboard.writeText([text, url].filter(Boolean).join("\n"));
    useApp.getState().toast("คัดลอกแล้ว วางในแอปไหนก็ได้");
  } catch {
    /* share sheet dismissed */
  }
}

/**
 * Open a link outside the app. In Capacitor, navigating to an external URL hands it to
 * Android/iOS, which opens the matching app (Spotify, YouTube, Apple Music…) when installed.
 */
export function openExternal(url: string) {
  if (native) window.location.href = url;
  else window.open(url, "_blank", "noopener");
}

/** Link to a station on the Do.T website; the app opens it ready to play. */
export function stationLink(stationId: string) {
  return `${REMOTE_BASE}?station=${encodeURIComponent(stationId)}`;
}
