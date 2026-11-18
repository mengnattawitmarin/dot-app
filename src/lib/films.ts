import { create } from "zustand";
import { titles, type Title } from "@/lib/catalog";
import { fetchPublishedText } from "@/lib/remote";
import { loadValue, saveValue } from "@/lib/storage";
import { useApp } from "@/lib/store";

/**
 * Free films (public domain / open licence, streamed from the Internet Archive).
 * public/films.json is rebuilt in CI by scripts/fetch-films.mjs; titles are merged into the
 * shared catalogue so the existing player, recents and favourites work unchanged.
 */
export type FilmGenre = { id: string; label: string };

export const useFilms = create<{ genres: FilmGenre[]; status: "idle" | "loading" | "ready" | "error" }>(() => ({
  genres: [],
  status: "idle",
}));

const CACHE_KEY = "dot-films-v1";

function apply(data: { genres?: FilmGenre[]; titles?: Title[] }) {
  for (const t of data.titles ?? []) {
    if (!t || typeof t.src !== "string" || !Array.isArray(t.palette)) continue;
    const at = titles.findIndex((x) => x.id === t.id);
    if (at >= 0) titles[at] = t;
    else titles.push(t);
  }
  useFilms.setState({ genres: data.genres ?? [], status: "ready" });
  useApp.getState().bumpCatalog();
}

export async function loadFilms() {
  if (useFilms.getState().status !== "idle") return;
  useFilms.setState({ status: "loading" });
  const cached = await loadValue(CACHE_KEY);
  if (cached) {
    try {
      apply(JSON.parse(cached));
    } catch {
      /* ignore */
    }
  }
  const text = await fetchPublishedText("films.json", 12000);
  if (!text) {
    if (useFilms.getState().status !== "ready") useFilms.setState({ status: "error" });
    return;
  }
  try {
    apply(JSON.parse(text));
    void saveValue(CACHE_KEY, text);
  } catch {
    if (useFilms.getState().status !== "ready") useFilms.setState({ status: "error" });
  }
}

export const filmsIn = (genre: string) => titles.filter((t) => t.genre === genre);
