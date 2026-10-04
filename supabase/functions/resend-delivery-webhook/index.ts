import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function verifyResendWebhook(req: Request, rawBody: string) {
  const secretValue = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secretValue) throw new Error("Webhook signing secret is not configured");
  const id = req.headers.get("svix-id") || "";
  const timestamp = req.headers.get("svix-timestamp") || "";
  const signatureHeader = req.headers.get("svix-signature") || "";
  if (!id || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const encodedSecret = secretValue.startsWith("whsec_") ? secretValue.slice(6) : secretValue;
  let secret: Uint8Array;
  try { secret = decodeBase64(encodedSecret); } catch { return false; }

  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new TextEncoder().encode(id + "." + timestamp + "." + rawBody);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  const candidates = signatureHeader.split(/\s+/).map(v => v.startsWith("v1,") ? v.slice(3) : v).filter(Boolean);
  return candidates.some(value => {
    try { return constantTimeEqual(expected, decodeBase64(value)); } catch { return false; }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const rawBody = await req.text();
    const verified = await verifyResendWebhook(req, rawBody);
    if (!verified) return Response.json({ error: "Invalid webhook signature" }, { status: 401 });

    const payload = JSON.parse(rawBody);
    const type = String(payload?.type || "");
    const data = payload?.data || {};
    const emailId = String(data?.email_id || data?.id || "");
    if (!emailId) return Response.json({ received: true, matched: false });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const patch: Record<string, unknown> = {};
    const now = payload?.created_at || new Date().toISOString();

    if (type === "email.sent") { patch.delivery_status = "sent"; patch.sent_at = now; }
    else if (type === "email.delivered") { patch.delivery_status = "delivered"; patch.delivered_at = now; }
    else if (type === "email.bounced") { patch.delivery_status = "bounced"; patch.failed_at = now; patch.failure_reason = "Email bounced"; }
    else if (type === "email.failed") { patch.delivery_status = "failed"; patch.failed_at = now; patch.failure_reason = "Delivery failed"; }
    else if (type === "email.delivery_delayed") { patch.delivery_status = "delayed"; }
    else if (type === "email.complained") { patch.delivery_status = "complained"; patch.failed_at = now; patch.failure_reason = "Recipient marked email as spam"; }
    else if (type === "email.suppressed") { patch.delivery_status = "suppressed"; patch.failed_at = now; patch.failure_reason = "Recipient is suppressed"; }
    else return Response.json({ received: true, ignored: true });

    const { data: rows, error } = await admin.from("client_communications").update(patch).eq("provider_message_id", emailId).select("id");
    if (error) throw error;
    return Response.json({ received: true, matched: (rows || []).length > 0 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
});