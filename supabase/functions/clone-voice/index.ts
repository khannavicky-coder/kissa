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
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!ELEVENLABS_API_KEY) return json(500, { error: "ELEVENLABS_API_KEY is not configured" });
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      return json(500, { error: "Supabase environment is not configured" });
    }

    // Identify caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Not authenticated" });
    const user = userData.user;

    // Parse incoming audio
    const contentType = req.headers.get("content-type") ?? "";
    let audioBlob: Blob | null = null;
    let displayName: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      if (file instanceof File) audioBlob = file;
      const dn = form.get("name");
      if (typeof dn === "string") displayName = dn;
    } else {
      return json(400, { error: "Send audio as multipart/form-data with field 'audio'" });
    }

    if (!audioBlob || audioBlob.size === 0) {
      return json(400, { error: "Missing audio file" });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Persist sample to private bucket (path scoped to user id for RLS)
    const ext = audioBlob.type.includes("mp4")
      ? "mp4"
      : audioBlob.type.includes("mpeg")
      ? "mp3"
      : "webm";
    const samplePath = `${user.id}/${Date.now()}.${ext}`;
    const sampleBytes = new Uint8Array(await audioBlob.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from("voice-samples")
      .upload(samplePath, sampleBytes, {
        contentType: audioBlob.type || "audio/webm",
        upsert: true,
      });
    if (uploadErr) {
      console.error("voice-sample upload error:", uploadErr);
      return json(500, { error: `Failed to store sample: ${uploadErr.message}` });
    }

    // Mark profile as pending
    await admin
      .from("voice_profiles")
      .upsert(
        {
          parent_user_id: user.id,
          sample_path: samplePath,
          status: "pending",
          error_message: null,
        },
        { onConflict: "parent_user_id" },
      );

    // Send to ElevenLabs voice cloning (Instant Voice Clone)
    const elForm = new FormData();
    elForm.append("name", `kissa-${displayName ?? user.id.slice(0, 8)}`);
    elForm.append(
      "description",
      "Kissa parent voice — used to narrate personalized bedtime stories.",
    );
    elForm.append("files", audioBlob, `sample.${ext}`);

    const elResp = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: elForm,
    });

    if (!elResp.ok) {
      const errText = await elResp.text();
      console.error("ElevenLabs clone error:", elResp.status, errText);
      await admin
        .from("voice_profiles")
        .update({ status: "failed", error_message: `ElevenLabs ${elResp.status}` })
        .eq("parent_user_id", user.id);

      if (elResp.status === 401) return json(401, { error: "ElevenLabs key is invalid." });
      if (elResp.status === 429) return json(429, { error: "ElevenLabs rate limit hit — try again." });
      return json(502, { error: `Voice cloning failed (${elResp.status})` });
    }

    const elData = await elResp.json();
    const voiceId: string | undefined = elData?.voice_id;
    if (!voiceId) {
      await admin
        .from("voice_profiles")
        .update({ status: "failed", error_message: "No voice_id returned" })
        .eq("parent_user_id", user.id);
      return json(502, { error: "ElevenLabs did not return a voice id" });
    }

    const { error: updErr } = await admin
      .from("voice_profiles")
      .update({
        elevenlabs_voice_id: voiceId,
        status: "ready",
        error_message: null,
      })
      .eq("parent_user_id", user.id);

    if (updErr) {
      console.error("voice_profiles update error:", updErr);
      return json(500, { error: `Failed to save voice profile: ${updErr.message}` });
    }

    return json(200, { voiceId, status: "ready" });
  } catch (e) {
    console.error("clone-voice error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
