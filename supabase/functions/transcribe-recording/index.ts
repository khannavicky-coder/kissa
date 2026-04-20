import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ELEVENLABS_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { audio, mimeType } = await req.json();
    if (!audio || typeof audio !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'audio' (base64 string) in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Decode base64 -> bytes (chunked to avoid stack overflow)
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const fileType = mimeType || "audio/webm";
    const ext = fileType.includes("mp4") ? "mp4" : fileType.includes("mpeg") ? "mp3" : "webm";
    const audioBlob = new Blob([bytes], { type: fileType });

    const form = new FormData();
    form.append("file", audioBlob, `recording.${ext}`);
    form.append("model_id", "scribe_v2");
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");

    const elResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: form,
    });

    if (!elResponse.ok) {
      const errText = await elResponse.text();
      console.error("ElevenLabs STT error:", elResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `Transcription failed (${elResponse.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await elResponse.json();
    return new Response(
      JSON.stringify({ text: data.text ?? "", language: data.language_code ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("transcribe-recording error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
