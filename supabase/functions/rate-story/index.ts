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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json(500, { error: "LOVABLE_API_KEY is not configured" });

    let body: { storyText?: string; childAge?: number };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const storyText = (body?.storyText ?? "").toString().trim();
    const childAge = typeof body?.childAge === "number" ? body.childAge : undefined;
    if (!storyText) return json(400, { error: "Missing 'storyText'" });

    const systemPrompt = `You are an expert children's-story editor. Rate a bedtime story on four axes from 1 to 10:
- engagement: how captivating and fun for the child
- ageAppropriateness: vocabulary, themes, and length suitability${childAge ? ` for a ${childAge}-year-old` : ""}
- clarity: easy to follow, well-paced, clean structure
- warmth: emotional warmth, comforting tone for bedtime
Also produce an overall score (1-10, may be decimal) and one short, actionable suggestion (max 20 words).`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Rate this bedtime story:\n\n${storyText}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_rating",
              description: "Return a structured story rating.",
              parameters: {
                type: "object",
                properties: {
                  overall: { type: "number", minimum: 1, maximum: 10 },
                  engagement: { type: "number", minimum: 1, maximum: 10 },
                  ageAppropriateness: { type: "number", minimum: 1, maximum: 10 },
                  clarity: { type: "number", minimum: 1, maximum: 10 },
                  warmth: { type: "number", minimum: 1, maximum: 10 },
                  summary: { type: "string", description: "One short sentence verdict." },
                  suggestion: { type: "string", description: "One short, actionable improvement (<=20 words)." },
                },
                required: ["overall", "engagement", "ageAppropriateness", "clarity", "warmth", "summary", "suggestion"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_rating" } },
      }),
    });

    if (aiResp.status === 429) return json(429, { error: "AI rate limit — try again in a moment." });
    if (aiResp.status === 402) return json(402, { error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return json(502, { error: `Rating failed (${aiResp.status})` });
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) return json(502, { error: "AI did not return a structured rating." });

    let rating: Record<string, unknown>;
    try {
      rating = JSON.parse(argsStr);
    } catch {
      return json(502, { error: "AI returned invalid rating JSON." });
    }

    return json(200, { rating });
  } catch (e) {
    console.error("rate-story error:", e);
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
