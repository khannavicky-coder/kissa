import { supabase } from "@/integrations/supabase/client";

export interface GenerateStoryParams {
  transcript: string;
  childName?: string;
  childAge?: number;
}

export interface GenerateStoryResult {
  story: string;
}

/**
 * Calls the `generate-story` edge function to turn a parent's spoken
 * message (already transcribed) into a warm bedtime story for the child.
 */
export async function generateStory({
  transcript,
  childName,
  childAge,
}: GenerateStoryParams): Promise<GenerateStoryResult> {
  const text = (transcript ?? "").trim();
  if (!text) {
    throw new Error("We couldn't hear any words — try recording again.");
  }

  const { data, error } = await supabase.functions.invoke("generate-story", {
    body: { transcript: text, childName, childAge },
  });

  if (error) {
    const msg = error.message || "Story generation failed";
    if (msg.includes("429")) {
      throw new Error("Too many requests — try again in a moment.");
    }
    if (msg.includes("402")) {
      throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
    }
    throw new Error(msg);
  }

  const story = (data?.story ?? "").toString();
  if (!story.trim()) {
    throw new Error("The story came back empty. Please try again.");
  }

  return { story };
}
