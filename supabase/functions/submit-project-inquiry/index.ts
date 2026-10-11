import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import webpush from "npm:web-push@3.6.7";
import {
  InputError,
  readBoundedJson,
  validateIntake,
} from "../_shared/intake-validation.ts";
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const hash = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const gateway = Deno.env.get("INTAKE_GATEWAY_SECRET"),
    hashSecret = Deno.env.get("INTAKE_HASH_SECRET");
  if (!gateway || !hashSecret)
    return json({ error: "Intake configuration unavailable" }, 503);
  const expected = await hmac(gateway, hashSecret),
    supplied = await hmac(
      req.headers.get("x-intake-gateway-secret") || "",
      hashSecret,
    );
  let difference = 0;
  for (let i = 0; i < expected.length; i++)
    difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (difference !== 0) return json({ error: "Unauthorized" }, 401);
  const ip = req.headers.get("x-intake-ip");
  if (!ip || ip.length > 64) return json({ error: "Invalid source" }, 400);
  try {
    const body = await readBoundedJson(req);
    if (typeof body.website === "string" && body.website.trim())
      return json({ ok: true });
    const input = validateIntake(body);
    const { name, project_type, budget_range } = input;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const ip_hash = await hmac(ip, hashSecret),
      request_id = crypto.randomUUID();
    const { data: admission, error } = await supabase.rpc(
      "submit_intake_atomic",
      { p_input: input, p_ip_hash: ip_hash, p_request_id: request_id },
    );
    if (error) {
      console.error("intake_database_failed", { code: error.code });
      return json(
        { error: "Unable to submit right now. Please try again." },
        500,
      );
    }
    if (admission?.rate_limited)
      return json(
        { error: "Too many recent submissions. Please try again later." },
        429,
      );
    if (admission?.duplicate) return json({ ok: true, duplicate: true });
    if (admission?.ok !== true)
      return json(
        { error: "Unable to submit right now. Please try again." },
        500,
      );
    // Notify active SRCcvde owners/admins on every subscribed device.
    // Notification failure must never make a valid customer inquiry look failed.
    const notify = async () => {
      try {
        const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
        const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
        if (publicKey && privateKey) {
          webpush.setVapidDetails(
            "mailto:admin@srccvde.com",
            publicKey,
            privateKey,
          );
          const { data: staff } = await supabase
            .from("app_memberships")
            .select("user_id,role")
            .in("role", ["owner", "admin"])
            .eq("status", "active");

          for (const member of staff || []) {
            const { data: pref } = await supabase
              .from("notification_preferences")
              .select("project_updates")
              .eq("user_id", member.user_id)
              .maybeSingle();
            if (pref?.project_updates === false) continue;

            const title = "New website inquiry";
            const summary = [name, project_type, budget_range]
              .filter(Boolean)
              .join(" · ");
            const notificationBody = summary.slice(0, 240);
            const tag = "website-inquiry-" + request_id;
            const url = "/leads";

            const { data: outbox } = await supabase
              .from("notification_outbox")
              .insert({
                recipient_user_id: member.user_id,
                category: "project_updates",
                title,
                body: notificationBody,
                url,
                tag,
                status: "processing",
                attempts: 1,
              })
              .select("id")
              .single();

            const { data: subs } = await supabase
              .from("push_subscriptions")
              .select("id,endpoint,p256dh,auth_key")
              .eq("user_id", member.user_id)
              .eq("enabled", true);

            let delivered = 0;
            for (const sub of subs || []) {
              try {
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth_key },
                  },
                  JSON.stringify({ title, body: notificationBody, url, tag }),
                );
                delivered++;
              } catch (pushError) {
                const statusCode = Number(
                  (pushError as { statusCode?: number })?.statusCode || 0,
                );
                if (statusCode === 404 || statusCode === 410) {
                  await supabase
                    .from("push_subscriptions")
                    .update({
                      enabled: false,
                      revoked_at: new Date().toISOString(),
                    })
                    .eq("id", sub.id);
                } else {
                  console.error("inquiry_push_delivery_failed", pushError);
                }
              }
            }

            if (outbox?.id) {
              await supabase
                .from("notification_outbox")
                .update({
                  status: delivered ? "sent" : "skipped",
                  last_error: delivered ? null : "no_deliverable_subscription",
                  processed_at: new Date().toISOString(),
                })
                .eq("id", outbox.id);
            }
          }
        } else {
          console.error("inquiry_push_not_configured");
        }
      } catch (notifyError) {
        console.error("inquiry_notification_failed", notifyError);
      }
    };
    EdgeRuntime.waitUntil(notify());
    return json({ ok: true, request_id }, 201);
  } catch (error) {
    if (error instanceof InputError)
      return json(
        { error: error.message },
        error.message === "Request too large" ? 413 : 400,
      );
    console.error("intake_failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return json(
      { error: "Unable to submit right now. Please try again." },
      500,
    );
  }
});
