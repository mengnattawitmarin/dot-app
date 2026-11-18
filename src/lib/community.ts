import { create } from "zustand";
import { titles, type Title } from "@/lib/catalog";
import { MAX_CLOUD_UPLOAD } from "@/lib/config";
import { registerShows, type Show } from "@/lib/stories";
import { useApp } from "@/lib/store";
import { currentUserId, supabase } from "@/lib/supabase";

/**
 * Listeners' own uploads (supabase/migrations/20261118000000_uploads.sql):
 *   story → audio, shown in เรื่องเล่า as "เรื่องเล่าจากผู้ฟัง" and played by the episode player
 *   film  → video, shown in หนัง as "หนังจากผู้ใช้" and played by the video player
 * Files go to the public "media" bucket (≤ 50 MB, the free-tier limit). Three reports hide an item.
 */
export type UploadKind = "story" | "film";
export type Upload = {
  id: string;
  kind: UploadKind;
  title: string;
  category: string;
  description: string;
  url: string;
  duration: number;
  handle: string;
  mine: boolean;
  created: number;
};

type Row = {
  id: string;
  kind: UploadKind;
  title: string;
  category: string | null;
  description: string | null;
  media_path: string;
  duration: number;
  user_id: string;
  created_at: string;
  profiles: { handle: string } | null;
};

export const COMMUNITY_SHOW = "cm-stories";
export const COMMUNITY_PREFIX = "cm-";

export const useCommunity = create<{
  stories: Upload[];
  films: Upload[];
  status: "idle" | "loading" | "ready" | "off" | "missing";
}>(() => ({ stories: [], films: [], status: "idle" }));

const mediaUrl = (path: string) => supabase!.storage.from("media").getPublicUrl(path).data.publicUrl;

function toUpload(r: Row): Upload {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    category: r.category ?? "",
    description: r.description ?? "",
    url: mediaUrl(r.media_path),
    duration: r.duration,
    handle: r.profiles?.handle ?? "ผู้ใช้",
    mine: r.user_id === currentUserId(),
    created: Date.parse(r.created_at) || 0,
  };
}

function publish(stories: Upload[], films: Upload[]) {
  // Stories → one show the shared episode player understands.
  const show: Show = {
    id: COMMUNITY_SHOW,
    category: "community",
    name: "เรื่องเล่าจากผู้ฟัง",
    author: "ผู้ฟัง Do.T",
    desc: "เรื่องเล่าที่ผู้ฟังอัปโหลดเอง",
    image: "",
    link: "",
    episodes: stories.map((u) => ({
      id: u.id,
      title: u.title,
      url: u.url,
      date: u.created,
      duration: u.duration,
      desc: [`โดย @${u.handle}`, u.category, u.description].filter(Boolean).join(" · "),
    })),
  };
  registerShows("community", stories.length ? [show] : []);
  // Films → titles with a generated poster.
  for (let i = titles.length - 1; i >= 0; i--) if (titles[i]!.genre === "community") titles.splice(i, 1);
  const palettes: Array<[string, string]> = [
    ["#5e2626", "#140606"],
    ["#22405e", "#060d16"],
    ["#4a2a4f", "#0f0712"],
    ["#2f4a3c", "#07110c"],
  ];
  const scenes: Title["scene"][] = ["rain", "drive", "ocean", "blocks", "horizon", "grain"];
  films.forEach((u, i) => {
    titles.push({
      id: COMMUNITY_PREFIX + u.id,
      name: u.title,
      tagline: [`โดย @${u.handle}`, u.category].filter(Boolean).join(" · "),
      kind: u.duration && u.duration < 20 * 60 ? "short" : "movie",
      year: new Date(u.created).getFullYear(),
      minutes: Math.round(u.duration / 60),
      rating: 0,
      src: u.url,
      palette: palettes[i % palettes.length]!,
      scene: scenes[i % scenes.length]!,
      tags: [],
      genre: "community",
      about: u.description,
    });
  });
  useApp.getState().bumpCatalog();
}

export async function loadCommunity() {
  if (!supabase) {
    useCommunity.setState({ status: "off" });
    return;
  }
  useCommunity.setState({ status: "loading" });
  let result: { data: unknown; error: { message: string } | null };
  try {
    result = await supabase
      .from("uploads")
      .select("id, kind, title, category, description, media_path, duration, user_id, created_at, profiles(handle)")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(200);
  } catch {
    useCommunity.setState({ status: "missing" });
    return;
  }
  const { data, error } = result;
  if (error) {
    // Table not created yet (migration not run) → hide the upload UI gracefully.
    useCommunity.setState({ status: /relation|does not exist|schema cache/i.test(error.message) ? "missing" : "ready" });
    return;
  }
  const all = ((data ?? []) as unknown as Row[]).map(toUpload);
  const stories = all.filter((u) => u.kind === "story");
  const films = all.filter((u) => u.kind === "film");
  useCommunity.setState({ stories, films, status: "ready" });
  publish(stories, films);
}

/** Duration of a local media file, read from its metadata (0 if the browser can't tell). */
export function mediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    const url = URL.createObjectURL(file);
    const done = (v: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v) ? Math.round(v) : 0);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => done(el.duration);
    el.onerror = () => done(0);
    window.setTimeout(() => done(0), 8000);
    el.src = url;
  });
}

export async function uploadMedia(
  kind: UploadKind,
  file: File,
  meta: { title: string; category: string; description: string },
): Promise<void> {
  const uid = currentUserId();
  if (!supabase || !uid) throw new Error("เข้าสู่ระบบก่อนอัปโหลด");
  if (file.size > MAX_CLOUD_UPLOAD) throw new Error("ไฟล์ต้องไม่เกิน 50 MB");
  const want = kind === "story" ? "audio" : "video";
  if (file.type && !file.type.startsWith(want)) throw new Error(kind === "story" ? "เลือกไฟล์เสียง (mp3, m4a)" : "เลือกไฟล์วิดีโอ (mp4)");
  const duration = await mediaDuration(file);
  const ext = (file.name.split(".").pop() || (kind === "story" ? "mp3" : "mp4")).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("media").upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) throw new Error(`อัปโหลดไม่สำเร็จ: ${up.error.message}`);
  const { error } = await supabase.from("uploads").insert({
    kind,
    title: meta.title.trim().slice(0, 120),
    category: meta.category.slice(0, 40) || null,
    description: meta.description.trim().slice(0, 600) || null,
    media_path: path,
    duration,
  });
  if (error) {
    await supabase.storage.from("media").remove([path]);
    throw new Error(error.message);
  }
  await loadCommunity();
}

export async function deleteUpload(id: string) {
  if (!supabase) return;
  const { data } = await supabase.from("uploads").select("media_path").eq("id", id).maybeSingle();
  await supabase.from("uploads").delete().eq("id", id);
  if (data?.media_path) await supabase.storage.from("media").remove([data.media_path]);
  await loadCommunity();
}

export async function reportUpload(id: string, reason: string) {
  if (!supabase || !currentUserId()) throw new Error("เข้าสู่ระบบก่อนรายงาน");
  const { error } = await supabase.from("upload_reports").insert({ upload_id: id, reason: reason.slice(0, 200) });
  if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
}
