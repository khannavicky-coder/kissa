import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });

  try {
    const ELEVENLABS_API_KEY =
      Deno.env.get("ElevenLabs") ?? Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!ELEVENLABS_API_KEY) {
      return json(500, { success: false, error: "ElevenLabs API key is not configured" });
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return json(500, { success: false, error: "Backend environment is not configured" });
    }

    // Identify caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json(401, { success: false, error: "Not authenticated" });
    }
    const user = userData.user;

    // Parse incoming audio (multipart/form-data)
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json(400, {
        success: false,
        error: "Send audio as multipart/form-data with field 'audio'",
      });
    }

    const form = await req.formData();
    const audioField = form.get("audio");
    if (!(audioField instanceof File) || audioField.size === 0) {
      return json(400, { success: false, error: "Missing audio file" });
    }

    const ext = audioField.type.includes("mp4")
      ? "mp4"
      : audioField.type.includes("mpeg")
      ? "mp3"
      : "webm";

    // Send to ElevenLabs Instant Voice Cloning
    const elForm = new FormData();
    elForm.append("name", `Kissa Parent Voice - ${user.id.slice(0, 8)}`);
    elForm.append("description", "Parent voice for Kissa bedtime stories");
    elForm.append("remove_background_noise", "true");
    elForm.append("files", audioField, `sample.${ext}`);

    const elResp = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: elForm,
    });

    if (!elResp.ok) {
      const errText = await elResp.text();
      console.error("ElevenLabs clone error:", elResp.status, errText);
      return json(200, {
        success: false,
        error: `ElevenLabs voice cloning failed (${elResp.status}): ${errText.slice(0, 300)}`,
      });
    }

    const elData = await elResp.json();
    const voiceId: string | undefined = elData?.voice_id;
    if (!voiceId) {
      return json(200, {
        success: false,
        error: "ElevenLabs did not return a voice id",
      });
    }

    // Persist to voice_profiles (upsert by parent_user_id)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { error: upsertErr } = await admin
      .from("voice_profiles")
      .upsert(
        {
          parent_user_id: user.id,
          elevenlabs_voice_id: voiceId,
          status: "ready",
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "parent_user_id" },
      );

    if (upsertErr) {
      console.error("voice_profiles upsert error:", upsertErr);
      return json(200, {
        success: false,
        error: `Failed to save voice profile: ${upsertErr.message}`,
      });
    }

    return json(200, { success: true, voiceId });
  } catch (e) {
    console.error("clone-voice error:", e);
    return json(200, {
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    });
  }
});
