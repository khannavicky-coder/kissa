import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const transcript: string = (body?.transcript ?? "").toString().slice(0, 4000);
    const childName: string = (body?.childName ?? "your little one").toString().slice(0, 60);
    const childAge: number | null = typeof body?.childAge === "number" ? body.childAge : null;

    if (!transcript.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing transcript" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ageHint = childAge ? ` who is ${childAge} years old` : "";
    const systemPrompt = `You are Kissa, a warm, gentle storyteller for children. Turn the parent's spoken message into a short, cozy bedtime story for ${childName}${ageHint}. Use simple, warm language with soft imagery (stars, moon, soft animals). Keep it to 4–6 short paragraphs. End with a peaceful "goodnight" line. Do not break character.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Parent's message:\n"""${transcript}"""\n\nWrite the bedtime story now.` },
        ],
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limits exceeded, please try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResponse.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Story generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiResponse.json();
    const story: string = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ story }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-story error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
