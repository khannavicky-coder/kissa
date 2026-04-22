import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Mic, Save, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader, AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getStory,
  getVoiceProfile,
  logStoryEdit,
  updateStory,
  type Story,
  type VoiceProfile,
} from "@/lib/supabaseService";

const StoryPreview = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [voice, setVoice] = useState<VoiceProfile | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Review story · Kissa";
  }, []);

  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      const [s, v] = await Promise.all([getStory(id), getVoiceProfile(user.id)]);
      if (cancelled) return;
      if (!s) { toast.error("Story not found"); navigate("/home", { replace: true }); return; }
      setStory(s);
      setText(s.edited_text ?? s.original_text ?? "");
      setVoice(v);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user, navigate]);

  const saveEdits = async (silent = false) => {
    if (!story || !user) return;
    setSaving(true);
    try {
      await updateStory(story.id, { edited_text: text });
      if ((story.original_text ?? "") !== text) {
        await logStoryEdit({
          story_id: story.id,
          parent_user_id: user.id,
          original_text: story.original_text ?? "",
          edited_text: text,
          edit_distance: Math.abs((story.original_text ?? "").length - text.length),
        });
      }
      if (!silent) toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const handleSynthesize = async () => {
    if (!story || !user) return;
    if (!voice || voice.status !== "ready" || !voice.elevenlabs_voice_id) {
      toast.error("Record your voice first so Kissa can narrate.");
      navigate("/record");
      return;
    }
    setSynthesizing(true);
    try {
      await saveEdits(true);
      const { data, error } = await supabase.functions.invoke("synthesize-voice", {
        body: { storyText: text, voiceId: voice.elevenlabs_voice_id },
      });
      if (error) throw new Error(error.message);
      const audioUrl = (data?.audioUrl ?? "").toString();
      if (!audioUrl) throw new Error("No audio returned");
      await updateStory(story.id, {
        audio_url: audioUrl,
        voice_id: voice.elevenlabs_voice_id,
        status: "ready",
      });
      toast.success("Your story is ready ✨");
      navigate(`/play/${story.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice synthesis failed");
    } finally {
      setSynthesizing(false);
    }
  };

  if (loading) {
    return (
      <AppShell hideNav>
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between animate-fade-up">
        <button onClick={() => navigate("/home")} className="flex items-center gap-1 text-sm font-semibold text-gold-soft hover:text-gold">
          <ArrowLeft className="h-4 w-4" /> Home
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-display text-lg font-bold text-gold">Kissa</span>
        </div>
      </header>

      <section className="mt-6 animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <p className="text-xs uppercase tracking-widest text-gold-soft">Parent review</p>
        <h1 className="mt-1 font-display text-3xl font-black leading-[1.05] text-gold sm:text-4xl">
          {story?.title || "Tonight's story"}
        </h1>
        <p className="mt-2 text-sm text-cream/70">
          Read it through. Edit anything that doesn't sound right. When you're happy, tap Narrate.
        </p>
      </section>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={18}
        className="mt-5 min-h-[420px] rounded-2xl border-2 border-border bg-card/60 p-5 text-[15px] leading-relaxed text-cream backdrop-blur-sm focus-visible:border-ring animate-fade-up font-display"
      />

      <div className="mt-5 grid gap-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <Button
          onClick={handleSynthesize}
          disabled={synthesizing || saving || !text.trim()}
          className="h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
        >
          {synthesizing ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Recording in your voice…</>
          ) : (
            <><Volume2 className="mr-2 h-5 w-5" /> Narrate in my voice</>
          )}
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => saveEdits(false)}
            disabled={saving || synthesizing}
            variant="outline"
            className="h-12 rounded-2xl border-2 border-border bg-secondary/60 text-sm font-semibold text-cream hover:bg-secondary"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="mr-2 h-4 w-4" /> Save draft</>)}
          </Button>
          <Button
            onClick={() => navigate("/record")}
            variant="outline"
            className="h-12 rounded-2xl border-2 border-border bg-secondary/60 text-sm font-semibold text-cream hover:bg-secondary"
          >
            <Mic className="mr-2 h-4 w-4" /> {voice?.status === "ready" ? "Re-record voice" : "Record voice"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
};

export default StoryPreview;
