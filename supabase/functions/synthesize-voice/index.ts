import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "story-audio";

// ── Voice configuration ────────────────────────────────────────────────────────
// PRIMARY: ElevenLabs — George, Warm Captivating Storyteller
// FALLBACK: OpenAI TTS — onyx, deep warm voice (same OpenAI key as Whisper)
const EL_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George
const OPENAI_TTS_VOICE = "onyx";              // Deep, warm, storyteller tone
const OPENAI_TTS_MODEL = "tts-1";            // Standard — fast & cost-effective

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const voiceUnavailable = (message: string) =>
  json(200, {
    audioUrl: null,
    recoverable: true,
    code: "VOICE_SERVICE_UNAVAILABLE",
    error: message,
  });

const getRequiredEnv = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

// ── ElevenLabs TTS ─────────────────────────────────────────────────────────────
async function synthesizeWithElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string,
): Promise<ArrayBuffer | null> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.85 },
      }),
    },
  );

  if (!res.ok) {
    // ANY failure (401 invalid key, 402 payment, 429 quota, 5xx, etc.)
    // → fall back to OpenAI TTS so audio always plays.
    const errText = await res.text().catch(() => "");
    console.warn(`ElevenLabs failed (${res.status}): ${errText}. Falling back to OpenAI TTS.`);
    return null;
  }

  const buffer = await res.arrayBuffer();
  if (!buffer.byteLength) throw new Error("ElevenLabs returned empty audio.");
  return buffer;
}

// ── OpenAI TTS fallback ────────────────────────────────────────────────────────
async function callOpenAITTS(
  text: string,
  apiKey: string,
  model: string,
): Promise<Response> {
  return fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      model,
      voice: OPENAI_TTS_VOICE,
      input: text,
      response_format: "mp3",
    }),
  });
}

async function synthesizeWithOpenAI(
  text: string,
  apiKey: string,
): Promise<ArrayBuffer | null> {
  console.log("Using OpenAI TTS fallback (onyx voice).");
  const models = [OPENAI_TTS_MODEL, "gpt-4o-mini-tts"];
  const delays = [0, 1000, 2500, 5000];
  let lastErr = "";

  for (const model of models) {
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) {
        console.warn(`OpenAI TTS retry ${i} for model=${model} after ${delays[i]}ms…`);
        await new Promise((r) => setTimeout(r, delays[i]));
      }
      const res = await callOpenAITTS(text, apiKey, model);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (!buf.byteLength) throw new Error("OpenAI TTS returned empty audio.");
        return buf;
      }
      if (res.status === 401) {
        console.warn("OpenAI TTS failed: API key invalid or expired.");
        return null;
      }
      lastErr = await res.text().catch(() => `${res.status}`);
      console.warn(`OpenAI TTS ${res.status} (model=${model}): ${lastErr.slice(0, 200)}`);
      // Only retry on 429/5xx; otherwise break to try next model
      if (res.status !== 429 && res.status < 500) break;
    }
  }
  console.warn(`OpenAI TTS unavailable after retries: ${lastErr.slice(0, 300)}`);
  return null;
}

// ── Main handler ───────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")?.trim() || "";
    const SUPABASE_URL = getRequiredEnv("SUPABASE_URL");
    const SERVICE_ROLE_KEY = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = getRequiredEnv("SUPABASE_ANON_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")?.trim() || "";

    // Identify caller — required so audio is stored under their folder and
    // protected by storage RLS (the bucket is private).
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "Not authenticated" });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: "Not authenticated" });
    const userId = userData.user.id;

    let body: { storyText?: string; voiceId?: string };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const storyText = (body?.storyText ?? "").toString().trim();
    if (!storyText) return json(400, { error: "Missing storyText" });

    // Use caller-supplied voiceId, fall back to George
    const requestedVoiceId = (body?.voiceId ?? "").toString().trim();
    const voiceId = /^[A-Za-z0-9]+$/.test(requestedVoiceId) ? requestedVoiceId : EL_VOICE_ID;

    // ── Step 1: Try ElevenLabs (skip if key not configured) ───────────────────
    let audioBuffer: ArrayBuffer | null = null;
    let provider = "elevenlabs";

    if (ELEVENLABS_API_KEY) {
      audioBuffer = await synthesizeWithElevenLabs(storyText, voiceId, ELEVENLABS_API_KEY);
    } else {
      console.warn("ELEVENLABS_API_KEY not configured — using OpenAI TTS directly.");
    }

    // ── Step 2: Auto-fallback to OpenAI TTS if quota hit ──────────────────────
    if (audioBuffer === null) {
      provider = "openai";
      if (!OPENAI_API_KEY) {
        console.warn("OPENAI_API_KEY not configured — no backup voice available.");
      } else {
        audioBuffer = await synthesizeWithOpenAI(storyText, OPENAI_API_KEY);
      }
    }

    if (audioBuffer === null) {
      return voiceUnavailable(
        "Narration is unavailable right now because both voice providers rejected the request. ElevenLabs needs a paid plan for this environment, and OpenAI needs available billing/credits.",
      );
    }

    // ── Step 3: Upload to Supabase Storage (private, scoped to user folder) ───
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const objectPath = `${userId}/${Date.now()}-${provider}-${voiceId}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, new Uint8Array(audioBuffer), {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return json(500, { error: `Failed to store audio: ${uploadError.message}` });
    }

    // Short-lived signed URL for immediate playback. The client persists
    // `audioPath` in `stories.audio_url` and re-signs it on later loads.
    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, 60 * 60); // 1 hour
    if (signErr || !signed?.signedUrl) {
      console.error("Signed URL error:", signErr);
      return json(500, { error: "Failed to sign audio URL" });
    }

    return json(200, { audioUrl: signed.signedUrl, audioPath: objectPath, provider, voiceId });

  } catch (e) {
    console.error("synthesize-voice error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});

