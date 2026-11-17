import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Hand an exported video to the user.
 * Android/iOS: write to the app cache, then open the share sheet — "Save to Photos / Gallery",
 * TikTok, LINE, Facebook, Instagram… Web: regular download.
 */
async function toBase64(blob: Blob) {
  return new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => fail(r.error);
    r.readAsDataURL(blob);
  });
}

export function exportFileName(mime: string) {
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
  return `DoT-${stamp}.${ext}`;
}

export async function saveOrShareVideo(blob: Blob, mime: string, mode: "share" | "save") {
  const name = exportFileName(mime);
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob);
    if (mode === "share" && navigator.canShare?.({ files: [new File([blob], name, { type: mime })] })) {
      await navigator.share({ files: [new File([blob], name, { type: mime })], title: "Do.T" }).catch(() => undefined);
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const data = await toBase64(blob);
  if (mode === "save") {
    // Try the public Movies folder (Android) / app Documents (iOS, visible in Files);
    // if the OS refuses, fall through to the share sheet ("Save to Photos / Gallery").
    for (const target of [
      { path: `Movies/DoT/${name}`, directory: Directory.ExternalStorage },
      { path: `DoT/${name}`, directory: Directory.Documents },
    ]) {
      try {
        const res = await Filesystem.writeFile({ ...target, data, recursive: true });
        return res.uri;
      } catch {
        /* try next */
      }
    }
  }
  const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
  await Share.share({ title: "Do.T", files: [uri], dialogTitle: "บันทึก / แชร์วิดีโอ" });
  return uri;
}
