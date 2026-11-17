import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/**
 * Key-value storage. Native apps use Capacitor Preferences (survives iOS WebView
 * storage eviction); the web build uses localStorage.
 */
const native = Capacitor.isNativePlatform();

export async function loadValue(key: string): Promise<string | null> {
  try {
    if (native) return (await Preferences.get({ key })).value;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function saveValue(key: string, value: string): Promise<void> {
  try {
    if (native) await Preferences.set({ key, value });
    else localStorage.setItem(key, value);
  } catch {
    /* storage full or unavailable — prefs stay in memory */
  }
}

export async function removeValue(key: string): Promise<void> {
  try {
    if (native) await Preferences.remove({ key });
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
