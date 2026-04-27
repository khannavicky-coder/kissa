import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return json(500, { error: "OPENAI_API_KEY is not configured" });

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return json(400, { error: "Expected multipart/form-data with an 'audio' file field" });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e) {
      console.error("Failed to parse form data:", e);
      return json(400, { error: "Invalid multipart/form-data body" });
    }

    const audioField = formData.get("audio");
    if (!(audioField instanceof File)) {
      return json(400, { error: "Missing 'audio' file field" });
    }

    const filename =
      audioField.name
        ? audioField.name
        : `recording.${(audioField.type || "audio/webm").includes("mp4") ? "mp4" : (audioField.type || "").includes("mpeg") ? "mp3" : "webm"}`;

    const openaiForm = new FormData();
    openaiForm.append("file", audioField, filename);
    openaiForm.append("model", "whisper-1");

    const oaResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: openaiForm,
    });

    if (oaResponse.status === 429) return json(429, { error: "OpenAI rate limit hit — try again in a moment." });
    if (oaResponse.status === 401) return json(401, { error: "OpenAI key is invalid. Update OPENAI_API_KEY." });
    if (!oaResponse.ok) {
      const errText = await oaResponse.text();
      console.error("OpenAI Whisper error:", oaResponse.status, errText);
      return json(502, { error: `Transcription failed (${oaResponse.status})` });
    }

    const data = await oaResponse.json();
    const transcript: string = (data?.text ?? "").toString();
    return json(200, { transcript });
  } catch (e) {
    console.error("transcribe-recording error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
