// Edge function: log-event
// Captures IP + geo from request headers, then inserts into audit_logs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify the calling user (if any) from the JWT
    let userId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await anon.auth.getUser();
      userId = data.user?.id ?? null;
    }

    const body = await req.json().catch(() => ({}));
    const {
      action,
      entity_type = null,
      entity_id = null,
      status = "success",
      error_message = null,
      metadata = {},
      timezone = null,
      occurred_at_local = null,
    } = body ?? {};

    if (!action || typeof action !== "string") {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IP from common proxy headers
    const xff = req.headers.get("x-forwarded-for") ?? "";
    const ip =
      req.headers.get("cf-connecting-ip") ??
      xff.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      null;

    // Geo from Cloudflare-style headers if present (free, industry standard at edge)
    let country = req.headers.get("cf-ipcountry");
    let city = req.headers.get("cf-ipcity");
    let region = req.headers.get("cf-region");

    // Fallback: free IP geolocation (no key required)
    if (ip && !country) {
      try {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, {
          headers: { "User-Agent": "lovable-audit/1.0" },
        });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          country = country ?? geo.country_code ?? null;
          city = city ?? geo.city ?? null;
          region = region ?? geo.region ?? null;
        }
      } catch (_) {
        // ignore geo failure — still log the event
      }
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error } = await admin.from("audit_logs").insert({
      user_id: userId,
      action,
      entity_type,
      entity_id: entity_id ? String(entity_id) : null,
      status,
      error_message,
      metadata,
      ip_address: ip,
      country,
      city,
      region,
      timezone,
      user_agent: req.headers.get("user-agent"),
      occurred_at_local,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
