import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { hasActiveAccess } from "./access-policy.ts";

/** Service-role callers must enforce suspension themselves; RLS is bypassed. */
export async function enforceActiveAccess(
  req: Request,
): Promise<Response | null> {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "https://app.srccvde.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "X-Content-Type-Options": "nosniff",
  };
  const deny = (status: number, error: string) =>
    new Response(JSON.stringify({ error }), { status, headers });
  if (req.method !== "POST") return deny(405, "Method not allowed");
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return deny(401, "Unauthorized");
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) return deny(401, "Unauthorized");
    const { data: claims, error: claimError } =
      await admin.auth.getClaims(token);
    if (claimError || !claims) return deny(401, "Unauthorized");
    const { data: member, error: memberError } = await admin
      .from("app_memberships")
      .select("role,status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (
      memberError ||
      !hasActiveAccess(member, claims.claims.aal as string | undefined)
    )
      return deny(403, "Active account required; staff must verify MFA.");
    return null;
  } catch {
    return deny(503, "Unable to verify account access. Please try again.");
  }
}
