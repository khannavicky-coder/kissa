import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT =
  "You are Kissa, a warm magical storyteller for children aged 3–9. Generate a bedtime story that is age-appropriate, free of all violence and horror, uses simple vocabulary, and ends on a calm hopeful note. Weave in a gentle financial literacy lesson naturally into the narrative — about saving, earning, choosing, sharing, or goal-setting. Use short paragraphs separated by blank lines. Do not add a title; just return the story body.";

const lengthTargets: Record<string, string> = {
  short: "around 200–300 words (a 2 minute read)",
  medium: "around 400–550 words (a 4 minute read)",
  long: "around 700–900 words (a 6 minute read)",
};

interface StoryInput {
  childName?: string;
  childAge?: number | string;
  theme?: string;
  lesson?: string;
  characters?: string;
  setting?: string;
  length?: "short" | "medium" | "long";
  transcript?: string;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { error: "LOVABLE_API_KEY is not configured" });

    let input: StoryInput;
    try {
      input = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const childName = (input.childName ?? "the child").toString();
    const childAge = (input.childAge ?? "5").toString();
    const theme = (input.theme ?? "").toString();
    const lesson = (input.lesson ?? "saving up for something special").toString();
    const characters = (input.characters ?? "").toString();
    const setting = (input.setting ?? "").toString();
    const length = (input.length ?? "medium") as "short" | "medium" | "long";
    const transcript = (input.transcript ?? "").toString().trim();

    const lengthHint = lengthTargets[length] ?? lengthTargets.medium;

    const userMessage = [
      `Write a bedtime story for ${childName}, aged ${childAge}.`,
      theme ? `Theme or adventure: ${theme}.` : "",
      characters ? `Include these characters: ${characters}.` : "",
      setting ? `Setting: ${setting}.` : "",
      `Financial lesson to weave in naturally: ${lesson}.`,
      `Length: ${lengthHint}.`,
      transcript ? `Use this voice note from the parent for inspiration: "${transcript}".` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (aiResponse.status === 429) {
      return json(429, { error: "Too many requests right now — please try again in a moment." });
    }
    if (aiResponse.status === 402) {
      return json(402, { error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." });
    }
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return json(502, { error: `Story generation failed (${aiResponse.status})` });
    }

    const data = await aiResponse.json();
    const story: string = (data?.choices?.[0]?.message?.content ?? "").trim();
    if (!story) return json(500, { error: "Empty story returned" });

    return json(200, { story, storyText: story });
  } catch (e) {
    console.error("generate-story error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
