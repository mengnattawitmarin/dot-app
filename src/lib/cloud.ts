import type { Clip } from "@/lib/catalog";
import { MAX_CLOUD_UPLOAD } from "@/lib/config";
import { currentUserId, supabase } from "@/lib/supabase";
import { useApp } from "@/lib/store";

/**
 * Online features backed by Supabase (see supabase/migrations). Every function is a
 * no-op / empty result when the backend isn't configured or the user is signed out.
 */

type ClipRow = {
  id: string;
  caption: string | null;
  video_path: string;
  likes_count: number;
  comments_count: number;
  user_id: string;
  profiles: { handle: string } | null;
};

export const CLOUD_PREFIX = "cloud-";
export const cloudId = (clipId: string) => (clipId.startsWith(CLOUD_PREFIX) ? clipId.slice(CLOUD_PREFIX.length) : null);

function publicUrl(path: string) {
  return supabase!.storage.from("clips").getPublicUrl(path).data.publicUrl;
}

function toClip(row: ClipRow): Clip {
  return {
    id: CLOUD_PREFIX + row.id,
    src: publicUrl(row.video_path),
    author: row.profiles?.handle ?? "ผู้ใช้",
    caption: row.caption || " ",
    credit: `@${row.profiles?.handle ?? "ผู้ใช้"}`,
    likes: row.likes_count,
    comments: row.comments_count,
    shares: 0,
    cloud: true,
    ownerId: row.user_id,
    mine: row.user_id === currentUserId(),
  };
}

export async function fetchCloudClips(): Promise<Clip[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("clips")
    .select("id, caption, video_path, likes_count, comments_count, user_id, profiles(handle)")
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error || !data) return [];
  const clips = (data as unknown as ClipRow[]).map(toClip);
  const liked = await syncLikedFlags(clips);
  // The UI adds 1 when the heart is filled, so don't count the user's own like twice.
  return clips.map((c) => (liked.has(c.id) ? { ...c, likes: Math.max(0, c.likes - 1) } : c));
}

/** Mark which cloud clips the signed-in user already liked, so hearts render filled. */
async function syncLikedFlags(clips: Clip[]): Promise<Set<string>> {
  const uid = currentUserId();
  if (!supabase || !uid || clips.length === 0) return new Set();
  const ids = clips.map((c) => cloudId(c.id)).filter(Boolean) as string[];
  const { data } = await supabase.from("clip_likes").select("clip_id").eq("user_id", uid).in("clip_id", ids);
  const liked = new Set((data ?? []).map((r: { clip_id: string }) => CLOUD_PREFIX + r.clip_id));
  const app = useApp.getState();
  const merged = [...new Set([...app.liked.filter((id) => !id.startsWith(CLOUD_PREFIX)), ...liked])];
  useApp.setState({ liked: merged });
  return liked;
}

export async function uploadCloudClip(file: File, caption: string): Promise<Clip> {
  const uid = currentUserId();
  if (!supabase || !uid) throw new Error("เข้าสู่ระบบก่อนโพสต์สาธารณะ");
  if (file.size > MAX_CLOUD_UPLOAD) throw new Error("คลิปออนไลน์ต้องไม่เกิน 50 MB");
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("clips").upload(path, file, { contentType: file.type || "video/mp4", upsert: false });
  if (up.error) throw new Error(`อัปโหลดไม่สำเร็จ: ${up.error.message}`);
  const { data, error } = await supabase
    .from("clips")
    .insert({ caption: caption.trim().slice(0, 220), video_path: path })
    .select("id, caption, video_path, likes_count, comments_count, user_id, profiles(handle)")
    .single();
  if (error || !data) {
    await supabase.storage.from("clips").remove([path]);
    throw new Error(error?.message ?? "บันทึกคลิปไม่สำเร็จ");
  }
  return toClip(data as unknown as ClipRow);
}

export async function deleteCloudClip(clip: Clip) {
  const id = cloudId(clip.id);
  if (!supabase || !id) return;
  const { data } = await supabase.from("clips").select("video_path").eq("id", id).maybeSingle();
  await supabase.from("clips").delete().eq("id", id);
  if (data?.video_path) await supabase.storage.from("clips").remove([data.video_path]);
}

export async function setCloudLike(clipId: string, liked: boolean) {
  const id = cloudId(clipId);
  if (!supabase || !id || !currentUserId()) return;
  if (liked) await supabase.from("clip_likes").upsert({ clip_id: id }, { onConflict: "clip_id,user_id", ignoreDuplicates: true });
  else await supabase.from("clip_likes").delete().eq("clip_id", id).eq("user_id", currentUserId()!);
}

export type CloudComment = { id: number; body: string; created_at: string; user_id: string; profiles: { handle: string } | null };

export async function fetchComments(clipId: string): Promise<CloudComment[]> {
  const id = cloudId(clipId);
  if (!supabase || !id) return [];
  const { data } = await supabase
    .from("clip_comments")
    .select("id, body, created_at, user_id, profiles(handle)")
    .eq("clip_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as unknown as CloudComment[]) ?? [];
}

export async function addComment(clipId: string, body: string) {
  const id = cloudId(clipId);
  if (!supabase || !id) throw new Error("ไม่พบคลิป");
  if (!currentUserId()) throw new Error("เข้าสู่ระบบก่อนคอมเมนต์");
  const { error } = await supabase.from("clip_comments").insert({ clip_id: id, body: body.slice(0, 300) });
  if (error) throw new Error(error.message);
}

export async function reportClip(clipId: string, reason: string) {
  const id = cloudId(clipId);
  if (!supabase || !id) return;
  if (!currentUserId()) throw new Error("เข้าสู่ระบบก่อนรายงาน");
  await supabase.from("clip_reports").upsert({ clip_id: id, reason }, { onConflict: "clip_id,user_id", ignoreDuplicates: true });
}

/* ---------- favourites sync ---------- */

let syncing = false;
let lastFavs: string[] = [];

/** Merge cloud favourites into the device, then push the union back. */
export async function pullFavorites() {
  const uid = currentUserId();
  if (!supabase || !uid) return;
  syncing = true;
  try {
    const { data } = await supabase.from("favorites").select("item_id").eq("user_id", uid);
    const remote = (data ?? []).map((r: { item_id: string }) => r.item_id);
    useApp.getState().importFavorites(remote);
    const local = useApp.getState().favorites;
    const missing = local.filter((id) => !remote.includes(id));
    if (missing.length) await supabase.from("favorites").upsert(missing.map((item_id) => ({ item_id })), { ignoreDuplicates: true });
    lastFavs = useApp.getState().favorites;
  } finally {
    syncing = false;
  }
}

/** Keep the cloud copy in step with every heart tap. */
export function watchFavorites() {
  lastFavs = useApp.getState().favorites;
  useApp.subscribe((state) => {
    if (state.favorites === lastFavs) return;
    const prev = lastFavs;
    lastFavs = state.favorites;
    if (syncing || !supabase || !currentUserId()) return;
    const added = state.favorites.filter((id) => !prev.includes(id));
    const removed = prev.filter((id) => !state.favorites.includes(id));
    // Postgrest builders are lazy — they only send the request once awaited / then()'d.
    if (added.length) void supabase.from("favorites").upsert(added.map((item_id) => ({ item_id })), { ignoreDuplicates: true }).then(() => undefined);
    if (removed.length) void supabase.from("favorites").delete().eq("user_id", currentUserId()!).in("item_id", removed).then(() => undefined);
  });
}

/* ---------- notifications inbox ---------- */

export type Notice = {
  id: number;
  kind: "like" | "comment" | "system";
  body: string | null;
  read: boolean;
  created_at: string;
  clip_id: string | null;
  actor: { handle: string } | null;
};

export async function fetchNotices(): Promise<Notice[]> {
  const uid = currentUserId();
  if (!supabase || !uid) return [];
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, body, read, created_at, clip_id, actor:profiles!notifications_actor_id_fkey(handle)")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as unknown as Notice[]) ?? [];
}

export async function markNoticesRead() {
  const uid = currentUserId();
  if (!supabase || !uid) return;
  await supabase.from("notifications").update({ read: true }).eq("user_id", uid).eq("read", false);
}

export async function saveDeviceToken(token: string, platform: string) {
  if (!supabase || !currentUserId()) return;
  // RPC re-assigns the token if this device was previously signed in as someone else.
  await supabase.rpc("register_device", { p_token: token, p_platform: platform });
}
