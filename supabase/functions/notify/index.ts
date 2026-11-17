// Supabase Edge Function: send a Firebase Cloud Messaging push for each new notification row.
// Triggered by a Database Webhook on INSERT into public.notifications (see docs/BACKEND.md).
//
// Secrets (supabase secrets set ...):
//   FIREBASE_SERVICE_ACCOUNT  — the Firebase service-account JSON (Project settings → Service accounts)
//   WEBHOOK_SECRET            — any random string; the webhook sends it in the x-webhook-secret header
import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "npm:jose@5";

type ServiceAccount = { project_id: string; client_email: string; private_key: string };
type NotificationRow = { user_id: string; actor_id: string | null; kind: string; body: string | null; clip_id: string | null };

const sa: ServiceAccount = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "{}");
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

let cached: { token: string; exp: number } | null = null;

async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const key = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = await res.json();
  cached = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return cached.token;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const payload = await req.json();
  const row: NotificationRow | undefined = payload.record;
  if (!row || !sa.private_key) return new Response("skip");

  const [{ data: actor }, { data: tokens }] = await Promise.all([
    row.actor_id ? db.from("profiles").select("handle").eq("id", row.actor_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("device_tokens").select("token").eq("user_id", row.user_id),
  ]);
  if (!tokens?.length) return new Response("no devices");

  const who = actor?.handle ? `@${actor.handle}` : "มีคน";
  const title = row.kind === "like" ? `${who} ถูกใจคลิปของคุณ ❤️` : row.kind === "comment" ? `${who} คอมเมนต์คลิปของคุณ` : "Do.T";
  const body = row.body ?? "แตะเพื่อดูใน Clipper";
  const bearer = await accessToken();

  const results = await Promise.all(
    tokens.map(async ({ token }: { token: string }) => {
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: { kind: row.kind, clip_id: row.clip_id ?? "" },
            android: { priority: "high", notification: { color: "#D6A856", sound: "default" } },
            apns: { payload: { aps: { sound: "default" } } },
          },
        }),
      });
      // Drop tokens Firebase says are gone (app uninstalled / token rotated).
      if (res.status === 404 || res.status === 400) await db.from("device_tokens").delete().eq("token", token);
      return res.status;
    }),
  );
  return Response.json({ sent: results });
});
