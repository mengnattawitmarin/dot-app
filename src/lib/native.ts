import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { closeChannel, closeTitle } from "@/lib/actions";
import { useApp } from "@/lib/store";

export const isNative = Capacitor.isNativePlatform();

/**
 * Native glue: dark status bar, splash hide, Android hardware back button.
 * Back closes the top-most overlay first, then returns to Home, then exits.
 */
export async function setupNative() {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setOverlaysWebView({ overlay: true });
    }
  } catch {
    /* status bar plugin not available */
  }

  void CapApp.addListener("backButton", () => {
    const s = useApp.getState();
    if (s.noticesOpen) return s.setNoticesOpen(false);
    if (s.activeTitle) return closeTitle();
    if (s.activeChannel) return closeChannel();
    if (s.nowOpen) return s.setNowOpen(false);
    if (s.tab === "editor" && !window.confirm("ออกจากการตัดต่อ? งานที่ยังไม่ได้ส่งออกจะหายไป")) return;
    if (s.tab !== "home") return s.setTab("home");
    void CapApp.minimizeApp();
  });

  window.setTimeout(() => void SplashScreen.hide().catch(() => undefined), 300);
}
