import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://app.srccvde.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://app.srccvde.com",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return replacements[character] || character;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed" }, 405);
  }

  try {
    const authorization = req.headers.get("Authorization") || "";

    if (!authorization.startsWith("Bearer ")) {
      return json(req, { error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(req, { error: "Supabase environment is incomplete" }, 500);
    }

    if (!resendKey) {
      return json(req, { error: "Email service is not configured" }, 503);
    }

    // Validate the signed-in user.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json(req, { error: "Unauthorized" }, 401);
    }

    // Service-role client is used only after authentication + staff authorization.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: membership, error: membershipError } = await admin
      .from("app_memberships")
      .select("role,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      membershipError ||
      !membership ||
      membership.status !== "active" ||
      membership.role === "client"
    ) {
      return json(req, { error: "Staff access required" }, 403);
    }

    const payload = await req.json();

    const clientId = String(payload.client_id || "");
    const projectId = payload.project_id || null;
    const subject = String(payload.subject || "").trim();
    const message = String(payload.body || "").trim();

    if (!clientId || !subject || !message) {
      return json(
        req,
        { error: "Client, subject, and message are required" },
        400,
      );
    }

    if (subject.length > 160 || message.length > 5000) {
      return json(req, { error: "Message is too long" }, 400);
    }

    const { data: client, error: clientError } = await admin
      .from("clients")
      .select("id,name,primary_contact_name,primary_email")
      .eq("id", clientId)
      .single();

    if (clientError || !client?.primary_email) {
      return json(req, { error: "Client email is unavailable" }, 404);
    }

    const contactName =
      client.primary_contact_name || client.name || "there";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#111;">
        <div style="font-size:22px;font-weight:700;margin-bottom:28px;">
          SRC<span style="font-weight:400;">cvde</span>
        </div>

        <p>Hi ${escapeHtml(contactName)},</p>

        <div style="white-space:pre-wrap;line-height:1.65;">
          ${escapeHtml(message)}
        </div>

        <p style="margin-top:32px;">— SRCcvde</p>

        <hr style="border:0;border-top:1px solid #ddd;margin-top:32px;">

        <p style="font-size:12px;color:#666;">
          Sent from your secure SRCcvde project workspace.
        </p>
      </div>
    `;

    const textBody =
      `Hi ${contactName},\n\n${message}\n\n— SRCcvde`;

    const resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SRCcvde <hello@srccvde.com>",
          to: [client.primary_email],
          reply_to: "hello@srccvde.com",
          subject,
          html,
          text: textBody,
        }),
      },
    );

    const resendResult = await resendResponse
      .json()
      .catch(() => ({}));

    if (!resendResponse.ok) {
      console.error("Resend error", resendResult);

      return json(
        req,
        {
          error:
            resendResult?.message ||
            "Email delivery failed",
        },
        502,
      );
    }

    // Only log as sent after Resend accepts the message.
    const { data: communication, error: logError } = await admin
      .from("client_communications")
      .insert({
        client_id: clientId,
        project_id: projectId,
        channel: "email",
        direction: "outbound",
        subject,
        body: message,
        created_by: user.id,
        recipient_email: client.primary_email,
        delivery_status: "sent",
        provider: "resend",
        provider_message_id: resendResult?.id || null,
        sent_at: new Date().toISOString(),
        client_visible: true,
      })
      .select("id")
      .single();

    if (logError) {
      console.error("Communication logging error", logError);

      return json(
        req,
        {
          error:
            "Email was sent, but communication history could not be recorded.",
          email_id: resendResult?.id,
        },
        500,
      );
    }

    return json(req, {
      sent: true,
      email_id: resendResult?.id,
      communication_id: communication?.id,
      to: client.primary_email,
    });
  } catch (error) {
    console.error(error);

    return json(
      req,
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error",
      },
      500,
    );
  }
});