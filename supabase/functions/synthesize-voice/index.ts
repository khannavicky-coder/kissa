import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "story-audio";

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

    if (!ELEVENLABS_API_KEY) return json(500, { error: "ELEVENLABS_API_KEY is not configured" });
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json(500, { error: "Supabase service role is not configured" });
    }

    let body: { storyText?: string; voiceId?: string };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const storyText = (body?.storyText ?? "").toString().trim();
    const voiceId = (body?.voiceId ?? "").toString().trim();

    if (!storyText) return json(400, { error: "Missing 'storyText'" });
    if (!voiceId) return json(400, { error: "Missing 'voiceId'" });

    // Call ElevenLabs TTS
    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: storyText,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.85,
          },
        }),
      },
    );

    if (elResponse.status === 401) return json(401, { error: "ElevenLabs key is invalid." });
    if (elResponse.status === 429) return json(429, { error: "ElevenLabs rate limit hit — try again." });
    if (!elResponse.ok) {
      const errText = await elResponse.text();
      console.error("ElevenLabs TTS error:", elResponse.status, errText);
      return json(502, { error: `Voice synthesis failed (${elResponse.status})` });
    }

    const audioBuffer = await elResponse.arrayBuffer();
    if (!audioBuffer.byteLength) return json(502, { error: "Empty audio returned from ElevenLabs" });

    // Upload to Supabase Storage with service role
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const filename = `${Date.now()}-${voiceId}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, new Uint8Array(audioBuffer), {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return json(500, { error: `Failed to store audio: ${uploadError.message}` });
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    const audioUrl = publicUrlData?.publicUrl;
    if (!audioUrl) return json(500, { error: "Failed to resolve public URL" });

    return json(200, { audioUrl });
  } catch (e) {
    console.error("synthesize-voice error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
