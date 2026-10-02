import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://srccvde.com",
  "https://www.srccvde.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const PROJECT_TYPES = new Set([
  "Website",
  "Web app",
  "PWA",
  "E-commerce",
  "Portal or dashboard",
  "Operations / internal tool",
  "Not sure yet",
  "Something else",
]);

const BUDGETS = new Set([
  "Not sure yet",
  "Under $2,500",
  "$2,500–$5,000",
  "$5,000–$10,000",
  "$10,000–$25,000",
  "$25,000+",
]);

const TIMELINES = new Set([
  "Flexible",
  "Within 1 month",
  "1–3 months",
  "3–6 months",
  "6+ months",
]);

const INVOLVEMENT = new Set([
  "Hands-off",
  "Collaborative",
  "Very involved",
  "Not sure yet",
]);

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://srccvde.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);
    return new Response("ok", { headers: cors(origin) });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed" }, 403, origin);

  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const publishableKey = publishableKeys["default"];
  const secretKey = secretKeys["default"];
  const suppliedKey = req.headers.get("apikey");

  if (!publishableKey || !secretKey) return json({ error: "Server configuration error" }, 500, origin);
  if (!suppliedKey || suppliedKey !== publishableKey) return json({ error: "Unauthorized" }, 401, origin);

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > 20_000) return json({ error: "Request too large" }, 413, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request" }, 400, origin);
  }

  // Honeypot: real users never see or fill this.
  if (clean(body.website, 200)) return json({ ok: true }, 200, origin);

  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const company = clean(body.company, 160);
  const project_type = clean(body.project_type, 80);
  const budget_range = clean(body.budget_range, 80) || "Not sure yet";
  const timeline = clean(body.timeline, 80) || "Flexible";
  const involvement = clean(body.involvement, 80) || "Collaborative";
  const details = clean(body.details, 5000);

  if (name.length < 2) return json({ error: "Please enter your name." }, 400, origin);
  if (!validEmail(email)) return json({ error: "Please enter a valid email." }, 400, origin);
  if (!PROJECT_TYPES.has(project_type)) return json({ error: "Please choose a project type." }, 400, origin);
  if (!BUDGETS.has(budget_range)) return json({ error: "Invalid budget range." }, 400, origin);
  if (!TIMELINES.has(timeline)) return json({ error: "Invalid timeline." }, 400, origin);
  if (!INVOLVEMENT.has(involvement)) return json({ error: "Invalid involvement preference." }, 400, origin);
  if (details.length < 20) return json({ error: "Please tell us a little more about the idea." }, 400, origin);

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const ip_hash = await hmac(ip, secretKey);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount, error: countError } = await supabase
    .from("project_inquiries")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ip_hash)
    .gte("created_at", oneHourAgo);

  if (countError) {
    console.error("rate_limit_check_failed", countError);
    return json({ error: "Unable to submit right now. Please try again." }, 500, origin);
  }

  if ((recentCount ?? 0) >= 5) {
    return json({ error: "Too many recent submissions. Please try again later." }, 429, origin);
  }

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: duplicate, error: duplicateError } = await supabase
    .from("project_inquiries")
    .select("id")
    .eq("email", email)
    .eq("project_type", project_type)
    .eq("details", details)
    .gte("created_at", tenMinutesAgo)
    .limit(1)
    .maybeSingle();

  if (duplicateError) {
    console.error("duplicate_check_failed", duplicateError);
    return json({ error: "Unable to submit right now. Please try again." }, 500, origin);
  }

  if (duplicate) return json({ ok: true, duplicate: true }, 200, origin);

  const request_id = crypto.randomUUID();
  const user_agent = clean(req.headers.get("user-agent"), 500);

  const { error: insertError } = await supabase.from("project_inquiries").insert({
    name,
    email,
    company: company || null,
    project_type,
    budget_range,
    timeline,
    involvement,
    details,
    status: "new",
    source: "website",
    request_id,
    ip_hash,
    origin,
    user_agent,
    metadata: { page: "/start" },
  });

  if (insertError) {
    console.error("inquiry_insert_failed", insertError);
    return json({ error: "Unable to submit right now. Please try again." }, 500, origin);
  }

  return json({ ok: true, request_id }, 201, origin);
});
