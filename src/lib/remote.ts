import { Capacitor } from "@capacitor/core";
import { channels, stations, titles, type Station, type Title, type TvChannel } from "@/lib/catalog";
import { useApp } from "@/lib/store";

/**
 * Remote catalogue + stream health.
 * The deployed site (GitHub Pages) hosts two JSON files:
 *   catalog.json        — extra or replacement stations / channels / titles (matched by id)
 *   stream-status.json  — ids the daily health check found dead (see scripts/check-streams.mjs)
 * The bundled catalogue is always the fallback, so the app works with no network.
 */
export const REMOTE_BASE = "https://mengnattawitmarin.github.io/dot-app/";

type RemoteCatalog = {
  stations?: Station[];
  channels?: TvChannel[];
  titles?: Title[];
  remove?: string[];
};

type StreamStatus = { checkedAt?: string; dead?: string[] };

function base() {
  // Native apps load from the device, so always ask the hosted site.
  return Capacitor.isNativePlatform() ? REMOTE_BASE : new URL("./", document.baseURI).href;
}

async function getJson<T>(file: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${base()}${file}?t=${Math.floor(Date.now() / 600_000)}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    window.clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function merge<T extends { id: string }>(list: T[], incoming: T[] | undefined, valid: (x: T) => boolean) {
  for (const item of incoming ?? []) {
    if (!item || typeof item.id !== "string" || !valid(item)) continue;
    const at = list.findIndex((x) => x.id === item.id);
    if (at >= 0) list[at] = item;
    else list.push(item);
  }
}

function drop<T extends { id: string }>(list: T[], ids: Set<string>) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i];
    if (item && ids.has(item.id)) list.splice(i, 1);
  }
}

export async function loadRemote() {
  const [catalog, status] = await Promise.all([
    getJson<RemoteCatalog>("catalog.json"),
    getJson<StreamStatus>("stream-status.json"),
  ]);
  let changed = false;
  if (catalog) {
    merge(stations, catalog.stations, (s) => s.kind === "studio" || (Array.isArray(s.urls) && s.urls.length > 0));
    merge(channels, catalog.channels, (c) => c.mode === "scene" || typeof c.src === "string");
    merge(titles, catalog.titles, (t) => typeof t.src === "string" && Array.isArray(t.palette));
    if (catalog.remove?.length) drop(stations, new Set(catalog.remove));
    changed = true;
  }
  if (status?.dead?.length) {
    // Never hide a station the listener is currently playing.
    const playing = useApp.getState().now?.id;
    const dead = new Set(status.dead.filter((id) => id !== playing));
    drop(stations, dead);
    drop(channels, dead);
    drop(titles, dead);
    changed = true;
  }
  if (changed) useApp.getState().bumpCatalog();
}
