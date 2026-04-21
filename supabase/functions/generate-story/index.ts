import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT =
  "You are Kissa, a warm magical storyteller for children aged 3–9. Generate a bedtime story that is age-appropriate, free of all violence and horror, uses simple vocabulary, and ends on a calm hopeful note. Weave in a gentle financial lesson naturally into the narrative. Keep the story between 300 and 600 words depending on the duration requested.";

interface StoryInput {
  childName?: string;
  childAge?: number | string;
  character?: string;
  location?: string;
  duration?: number | string;
  exclusions?: string;
  financialLesson?: string;
  extraDetails?: string;
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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) return json(500, { error: "OPENAI_API_KEY is not configured" });

    let input: StoryInput;
    try {
      input = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const {
      childName = "the child",
      childAge = "",
      character = "",
      location = "",
      duration = "",
      exclusions = "",
      financialLesson = "",
      extraDetails = "",
    } = input ?? {};

    const userMessage =
      `Write a story for ${childName}, aged ${childAge}. ` +
      `Main character: ${character}. ` +
      `Location: ${location}. ` +
      `Story duration: ${duration} minutes. ` +
      `Do not include: ${exclusions}. ` +
      `Financial lesson to weave in: ${financialLesson}. ` +
      `Extra details: ${extraDetails}.`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
      }),
    });

    if (aiResponse.status === 429) return json(429, { error: "OpenAI rate limit hit — try again in a moment." });
    if (aiResponse.status === 401) return json(401, { error: "OpenAI key is invalid. Update OPENAI_API_KEY." });
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      return json(502, { error: `Story generation failed (${aiResponse.status})` });
    }

    const data = await aiResponse.json();
    const storyText: string = data?.choices?.[0]?.message?.content ?? "";
    if (!storyText.trim()) return json(500, { error: "Empty story returned" });

    return json(200, { storyText });
  } catch (e) {
    console.error("generate-story error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
