import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Wand2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader, AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createStory, listChildren, type Child } from "@/lib/supabaseService";

const LESSONS = [
  "Saving up for something special",
  "Earning by helping others",
  "Sharing what you have",
  "Choosing wants vs needs",
  "Setting a goal and reaching it",
];

const LENGTHS: { key: "short" | "medium" | "long"; label: string; sub: string }[] = [
  { key: "short", label: "Short", sub: "~2 min" },
  { key: "medium", label: "Medium", sub: "~4 min" },
  { key: "long", label: "Long", sub: "~6 min" },
];

const schema = z.object({
  setting: z.string().trim().min(2, "Add a quick idea").max(500),
  characters: z.string().trim().max(200).optional(),
  length: z.enum(["short", "medium", "long"]),
});

const StoryBrief = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const childIdParam = params.get("childId");

  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string>(childIdParam ?? "");
  const [setting, setSetting] = useState("");
  const [characters, setCharacters] = useState("");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "New story · Kissa";
  }, []);

  useEffect(() => {
    if (!user) return;
    listChildren(user.id).then((kids) => {
      setChildren(kids);
      if (!childId && kids[0]) setChildId(kids[0].id);
    });
  }, [user, childId]);

  const child = children.find((c) => c.id === childId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!childId) {
      toast.error("Pick a child first");
      return;
    }
    const parsed = schema.safeParse({ setting, characters, length });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => { fe[i.path[0] as string] = i.message; });
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      // 1. Create draft
      const draft = await createStory({
        parent_user_id: user.id,
        child_id: childId,
        title: parsed.data.setting.slice(0, 60),
        theme: null,
        lesson: null,
        characters: parsed.data.characters || null,
        setting: parsed.data.setting,
        length: parsed.data.length,
        status: "generating",
      });

      // 2. Call generate-story
      const { data, error } = await supabase.functions.invoke("generate-story", {
        body: {
          childName: child?.name,
          childAge: child?.age,
          setting: parsed.data.setting,
          characters: parsed.data.characters,
          length: parsed.data.length,
        },
      });

      if (error) throw new Error(error.message);
      const story = (data?.story ?? data?.storyText ?? "").toString().trim();
      if (!story) throw new Error("No story returned");

      // 3. Save original_text + edited_text (start as same), set draft status
      await supabase
        .from("stories")
        .update({ original_text: story, edited_text: story, status: "draft" })
        .eq("id", draft.id);

      navigate(`/preview/${draft.id}`, { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <AppHeader />

      <section className="mt-6 animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <p className="text-xs uppercase tracking-widest text-gold-soft">New story</p>
        <h1 className="mt-1 font-display text-3xl font-black leading-[1.05] text-gold sm:text-4xl">
          Tell Kissa what to dream up
        </h1>
      </section>

      <form onSubmit={handleGenerate} className="mt-6 space-y-5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        {/* Child picker */}
        {children.length > 1 && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-gold-soft">For</Label>
            <div className="flex gap-2">
              {children.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setChildId(c.id)}
                  className={cn(
                    "flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition-all",
                    childId === c.id ? "bg-gradient-gold text-primary-foreground shadow-gold" : "bg-secondary text-cream/80",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="setting" className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
            What all do you want in your story
          </Label>
          <Textarea
            id="setting"
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            placeholder="A dragon who collects shiny coins, a magical forest, and a treasure chest..."
            rows={3}
            className="rounded-xl border-2 border-border bg-input/60 px-4 py-3"
          />
          {errors.setting && <p className="text-xs font-medium text-destructive">{errors.setting}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="characters" className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
            Characters <span className="ml-1 normal-case tracking-normal text-cream/50">(optional)</span>
          </Label>
          <Input
            id="characters"
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
            placeholder="Best friend Aisha, a sleepy puppy"
            className="h-12 rounded-xl border-2 border-border bg-input/60 px-4"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-gold-soft">Length</Label>
          <div className="grid grid-cols-3 gap-2">
            {LENGTHS.map((l) => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLength(l.key)}
                className={cn(
                  "rounded-2xl px-3 py-3 text-sm font-bold transition-all",
                  length === l.key ? "bg-gradient-gold text-primary-foreground shadow-gold" : "bg-secondary text-cream/80",
                )}
              >
                <div>{l.label}</div>
                <div className={cn("text-[10px] uppercase tracking-widest", length === l.key ? "text-primary-foreground/80" : "text-cream/50")}>{l.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting || !childId}
          className="h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
        >
          {submitting ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Weaving your story…</>
          ) : (
            <><Wand2 className="mr-2 h-5 w-5" /> Generate story</>
          )}
        </Button>
      </form>
    </AppShell>
  );
};

export default StoryBrief;
