import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Mic, Save, Sparkles, Star, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppShell } from "@/components/AppShell";
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



interface StoryRating {
  overall: number;
  engagement: number;
  ageAppropriateness: number;
  clarity: number;
  warmth: number;
  summary: string;
  suggestion: string;
}

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
  const [autoRate, setAutoRate] = useState(true);
  const [rating, setRating] = useState<StoryRating | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);


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
      // Default to "my voice" if cloned voice is ready, otherwise first preset
      if (v?.status === "ready" && v?.elevenlabs_voice_id) {
        setSelectedVoice(MY_VOICE_VALUE);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, user, navigate]);

  const fetchRating = async (storyText: string) => {
    if (!storyText.trim()) return;
    setRatingLoading(true);
    setRatingError(null);
    try {
      const { data, error } = await supabase.functions.invoke("rate-story", {
        body: { storyText },
      });
      if (error) throw new Error(error.message);
      const r = data?.rating as StoryRating | undefined;
      if (!r) throw new Error("No rating returned");
      setRating(r);
    } catch (err) {
      setRating(null);
      setRatingError(err instanceof Error ? err.message : "Couldn't rate story");
    } finally {
      setRatingLoading(false);
    }
  };

  // Auto-rate when story loads (and when toggled on)
  useEffect(() => {
    if (!story || !autoRate || rating || ratingLoading) return;
    fetchRating(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, autoRate]);

  const resolvedVoiceId = useMemo(() => {
    if (selectedVoice === MY_VOICE_VALUE) return voice?.elevenlabs_voice_id ?? null;
    return selectedVoice;
  }, [selectedVoice, voice]);

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
    if (!resolvedVoiceId) {
      toast.error("Pick a voice or record your own first.");
      return;
    }
    setSynthesizing(true);
    try {
      await saveEdits(true);
      const { data, error } = await supabase.functions.invoke("synthesize-voice", {
        body: { storyText: text, voiceId: resolvedVoiceId },
      });
      if (error) throw new Error(error.message);
      const audioUrl = (data?.audioUrl ?? "").toString();
      if (!audioUrl) throw new Error("No audio returned");
      await updateStory(story.id, {
        audio_url: audioUrl,
        voice_id: resolvedVoiceId,
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

  const myVoiceReady = voice?.status === "ready" && !!voice?.elevenlabs_voice_id;

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
          Read it through. Edit anything that doesn't sound right. Pick a voice, then tap Narrate.
        </p>
      </section>

      {/* Auto-rating card */}
      <section
        className="mt-5 rounded-2xl border-2 border-border bg-card/60 p-4 backdrop-blur-sm animate-fade-up"
        style={{ animationDelay: "0.07s" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-gold" />
            <div>
              <p className="text-sm font-semibold text-cream">AI story rating</p>
              <p className="text-xs text-cream/60">Auto-scored by AI as soon as the story is ready.</p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-cream/70">
            <input
              type="checkbox"
              checked={autoRate}
              onChange={(e) => {
                setAutoRate(e.target.checked);
                if (e.target.checked && !rating && !ratingLoading) fetchRating(text);
              }}
              className="h-4 w-4 accent-gold"
            />
            Auto-rate
          </label>
        </div>

        <div className="mt-3">
          {ratingLoading ? (
            <div className="flex items-center gap-2 text-sm text-cream/70">
              <Loader2 className="h-4 w-4 animate-spin" /> Rating story…
            </div>
          ) : ratingError ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-destructive">{ratingError}</p>
              <Button size="sm" variant="outline" onClick={() => fetchRating(text)} className="h-8 rounded-lg border-border bg-secondary/60 text-xs text-cream">
                Retry
              </Button>
            </div>
          ) : rating ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-black text-gold">{rating.overall.toFixed(1)}</span>
                <span className="text-sm text-cream/60">/ 10</span>
              </div>
              <p className="text-sm text-cream/80">{rating.summary}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-cream/70">
                <div className="flex justify-between rounded-lg bg-secondary/40 px-2 py-1.5"><span>Engagement</span><span className="font-semibold text-cream">{rating.engagement}/10</span></div>
                <div className="flex justify-between rounded-lg bg-secondary/40 px-2 py-1.5"><span>Age-fit</span><span className="font-semibold text-cream">{rating.ageAppropriateness}/10</span></div>
                <div className="flex justify-between rounded-lg bg-secondary/40 px-2 py-1.5"><span>Clarity</span><span className="font-semibold text-cream">{rating.clarity}/10</span></div>
                <div className="flex justify-between rounded-lg bg-secondary/40 px-2 py-1.5"><span>Warmth</span><span className="font-semibold text-cream">{rating.warmth}/10</span></div>
              </div>
              {rating.suggestion && (
                <p className="rounded-lg border border-border bg-secondary/30 p-2 text-xs text-cream/80">
                  <span className="font-semibold text-gold">Tip: </span>{rating.suggestion}
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchRating(text)}
                className="h-8 rounded-lg border-border bg-secondary/60 text-xs text-cream"
              >
                Re-rate
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchRating(text)}
              className="h-8 rounded-lg border-border bg-secondary/60 text-xs text-cream"
            >
              Rate this story
            </Button>
          )}
        </div>
      </section>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        className="mt-5 min-h-[320px] rounded-2xl border-2 border-border bg-card/60 p-5 text-[15px] leading-relaxed text-cream backdrop-blur-sm focus-visible:border-ring animate-fade-up font-display"
      />

      {/* Voice picker */}
      <section className="mt-5 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <label className="text-xs uppercase tracking-widest text-gold-soft">Narrator voice</label>
        <Select value={selectedVoice} onValueChange={setSelectedVoice}>
          <SelectTrigger className="mt-2 h-12 rounded-2xl border-2 border-border bg-card/60 text-cream">
            <SelectValue placeholder="Choose a voice" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            {myVoiceReady && (
              <SelectItem value={MY_VOICE_VALUE}>
                <span className="font-semibold">My cloned voice</span>
                <span className="ml-2 text-xs text-muted-foreground">Your recording</span>
              </SelectItem>
            )}
            {PRESET_VOICES.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                <span className="font-semibold">{v.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{v.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-cream/50">
          {myVoiceReady
            ? "Pick your cloned voice or any free ElevenLabs preset."
            : "Free ElevenLabs preset voices. Record your own to add a personal voice."}
        </p>
      </section>

      <div className="mt-5 grid gap-3 animate-fade-up" style={{ animationDelay: "0.12s" }}>
        <Button
          onClick={handleSynthesize}
          disabled={synthesizing || saving || !text.trim() || !resolvedVoiceId}
          className="h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
        >
          {synthesizing ? (
            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Recording narration…</>
          ) : (
            <><Volume2 className="mr-2 h-5 w-5" /> Narrate story</>
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
            <Mic className="mr-2 h-4 w-4" /> {myVoiceReady ? "Re-record voice" : "Record my voice"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
};

export default StoryPreview;
