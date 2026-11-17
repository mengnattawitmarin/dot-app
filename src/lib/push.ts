import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { PUSH_ENABLED } from "@/lib/config";
import { saveDeviceToken } from "@/lib/cloud";
import { loadValue, saveValue } from "@/lib/storage";
import { useApp } from "@/lib/store";

/**
 * Firebase Cloud Messaging push (Android via google-services.json, iOS via APNs key in Firebase).
 * Only active in native builds made with PUSH_ENABLED — calling register() without Firebase
 * config crashes Android, so this is gated at build time.
 */
const KEY = "dot-push-on";
export const pushAvailable = PUSH_ENABLED && Capacitor.isNativePlatform();
let listening = false;

export async function pushWanted() {
  return (await loadValue(KEY)) === "1";
}

function listen() {
  if (listening) return;
  listening = true;
  void PushNotifications.addListener("registration", (t) => void saveDeviceToken(t.value, Capacitor.getPlatform()));
  void PushNotifications.addListener("registrationError", () => useApp.getState().toast("เปิดการแจ้งเตือนไม่สำเร็จ"));
  void PushNotifications.addListener("pushNotificationReceived", (n) => {
    useApp.getState().toast(n.title ? `${n.title}${n.body ? ` — ${n.body}` : ""}` : "มีการแจ้งเตือนใหม่");
    useApp.getState().bumpNotices();
  });
  void PushNotifications.addListener("pushNotificationActionPerformed", () => {
    useApp.getState().setTab("clipper");
    useApp.getState().setNoticesOpen(true);
  });
}

/** Ask permission and register; returns whether push is now on. */
export async function enablePush(): Promise<boolean> {
  if (!pushAvailable) return false;
  listen();
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") {
    useApp.getState().toast("ยังไม่ได้อนุญาตการแจ้งเตือนในตั้งค่าเครื่อง");
    return false;
  }
  await PushNotifications.register();
  await saveValue(KEY, "1");
  return true;
}

export async function disablePush() {
  await saveValue(KEY, "0");
  if (pushAvailable) await PushNotifications.unregister().catch(() => undefined);
}

/** Re-register on launch (tokens rotate) if the user turned push on before. */
export async function resumePush() {
  if (pushAvailable && (await pushWanted())) await enablePush();
}
