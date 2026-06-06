import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pause, Play, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, Stars } from "@/components/AppShell";
import { toast } from "sonner";
import { getStory, incrementPlayCount, type Story } from "@/lib/supabaseService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const CHARACTER_VOICES = [
  { id: "xwUbPOIZ6ZbN2HDwIH9H", emoji: "🐰", name: "Squeaky Rabbit" },
  { id: "DV4mEkJgV8ZwNCOrjF7L", emoji: "🐻", name: "Grumpy Bear" },
  { id: "9m6m0XokgtJFpqsimBiN", emoji: "🐒", name: "Giggly Monkey" },
  { id: "AVYJxaX5Uon5HKPfdVo9", emoji: "🐭", name: "Tiny Mouse" },
] as const;

const CHARACTER_PREVIEW_TEXT = "Hello! I will tell your story tonight!";

const formatTime = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const StoryPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [counted, setCounted] = useState(false);

  // Character picker state (per-story, not persisted)
  const [childPicksVoice, setChildPicksVoice] = useState<boolean | null>(null);
  const [pickerDone, setPickerDone] = useState(false);
  const [pickedVoiceId, setPickedVoiceId] = useState<string | null>(null);
  const [glowVoiceId, setGlowVoiceId] = useState<string | null>(null);
  const [resynthesizing, setResynthesizing] = useState(false);
  const [overrideAudioUrl, setOverrideAudioUrl] = useState<string | null>(null);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    document.title = "Story time · Kissa";
  }, []);

  useEffect(() => {
    if (!id) return;
    getStory(id).then((s) => {
      if (!s) { toast.error("Story not found"); navigate("/home", { replace: true }); return; }
      setStory(s);
      setLoading(false);
    });
    // Reset per-story picker state when navigating to a new story
    setPickerDone(false);
    setPickedVoiceId(null);
    setOverrideAudioUrl(null);
    setOverrideAudioUrl(null);
    setResolvedAudioUrl(null);
  }, [id, navigate]);

  // Resolve story.audio_url. If it's a storage path (not a full URL), sign it
  // against the private `story-audio` bucket so the audio element can fetch it.
  useEffect(() => {
    let cancelled = false;
    const value = story?.audio_url ?? null;
    if (!value) { setResolvedAudioUrl(null); return; }
    if (/^https?:\/\//i.test(value)) {
      setResolvedAudioUrl(value);
      return;
    }
    supabase.storage
      .from("story-audio")
      .createSignedUrl(value, 60 * 60)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setResolvedAudioUrl(null);
          return;
        }
        setResolvedAudioUrl(data.signedUrl);
      });
    return () => { cancelled = true; };
  }, [story?.audio_url]);

  // Load parent preference
  useEffect(() => {
    if (!user) { setChildPicksVoice(false); return; }
    supabase
      .from("profiles")
      .select("child_picks_voice")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setChildPicksVoice(!!data?.child_picks_voice);
      });
  }, [user]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !audioSrc) return;
    if (el.paused) {
      await el.play();
      setPlaying(true);
      if (!counted && story) {
        setCounted(true);
        incrementPlayCount(story.id, story.played_count).catch(() => {});
      }
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const handleShare = async () => {
    if (!story) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: story.title || "A Kissa story", url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  };

  const handleCharacterPick = async (voiceId: string) => {
    if (resynthesizing || !story) return;
    setPickedVoiceId(voiceId);
    setGlowVoiceId(voiceId);

    // Play short preview
    try {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      const { data: previewData } = await supabase.functions.invoke("synthesize-voice", {
        body: { storyText: CHARACTER_PREVIEW_TEXT, voiceId },
      });
      const previewUrl = previewData?.audioUrl;
      if (previewUrl) {
        const previewAudio = new Audio(previewUrl);
        previewAudioRef.current = previewAudio;
        previewAudio.play().catch(() => {});
      }
    } catch {
      // non-fatal
    }

    // Re-synthesize the full story with the chosen voice (in parallel-ish with preview)
    setResynthesizing(true);
    try {
      const storyText = story.edited_text ?? story.original_text ?? "";
      const { data, error } = await supabase.functions.invoke("synthesize-voice", {
        body: { storyText, voiceId },
      });
      if (error) throw new Error(error.message);
      if (data?.recoverable) {
        toast.error(data.error || "Narration is unavailable right now.");
        setResynthesizing(false);
        return;
      }
      const audioUrl = (data?.audioUrl ?? "").toString();
      if (!audioUrl) throw new Error("No audio returned");
      setOverrideAudioUrl(audioUrl);
      setPickerDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't prepare the story voice");
      setPickedVoiceId(null);
      setGlowVoiceId(null);
    } finally {
      setResynthesizing(false);
    }
  };

  if (loading || !story || childPicksVoice === null) {
    return (
      <AppShell hideNav>
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
      </AppShell>
    );
  }

  const showPicker = childPicksVoice && !pickerDone && !!story.audio_url;

  if (showPicker) {
    return (
      <main className="relative min-h-screen w-full overflow-hidden bg-gradient-aurora">
        <Stars />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "hsl(var(--gold) / 0.6)" }}
        />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-8 sm:max-w-lg">
          <header className="flex items-center justify-between animate-fade-up">
            <button onClick={() => navigate("/library")} className="flex items-center gap-1 text-sm font-semibold text-gold-soft hover:text-gold">
              <ArrowLeft className="h-4 w-4" /> Library
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              <span className="font-display text-lg font-bold text-gold">Kissa</span>
            </div>
          </header>

          <section className="mt-12 flex-1 text-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
            <h1 className="font-display text-3xl font-black leading-[1.1] text-gold sm:text-4xl">
              Who's telling your story tonight?
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm text-cream/70">
              Tap a character to hear them.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-4">
              {CHARACTER_VOICES.map((voice) => {
                const isPicked = pickedVoiceId === voice.id;
                const glowing = glowVoiceId === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    disabled={resynthesizing && !isPicked}
                    onClick={() => handleCharacterPick(voice.id)}
                    className={`group relative flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl border-2 p-4 backdrop-blur-sm transition-all active:scale-95 disabled:opacity-50 ${
                      isPicked
                        ? "border-gold bg-card/80 shadow-gold scale-[1.02]"
                        : "border-border bg-card/60 hover:border-gold/50"
                    } ${glowing ? "animate-pulse-glow" : ""}`}
                    style={
                      glowing
                        ? { boxShadow: "0 0 40px hsl(var(--gold) / 0.6), 0 0 80px hsl(var(--gold) / 0.3)" }
                        : undefined
                    }
                  >
                    <span className="text-[72px] leading-none" aria-hidden>
                      {voice.emoji}
                    </span>
                    <span className="font-display text-base font-bold text-cream">{voice.name}</span>
                    {isPicked && resynthesizing && (
                      <Loader2 className="absolute right-3 top-3 h-5 w-5 animate-spin text-gold" />
                    )}
                  </button>
                );
              })}
            </div>

            {resynthesizing && (
              <p className="mt-8 text-sm text-cream/70">Getting your story ready…</p>
            )}
          </section>
        </div>
      </main>
    );
  }

  const audioSrc = overrideAudioUrl ?? story.audio_url;

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-aurora">
      <Stars />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "hsl(var(--gold) / 0.6)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-8 sm:max-w-lg">
        <header className="flex items-center justify-between animate-fade-up">
          <button onClick={() => navigate("/library")} className="flex items-center gap-1 text-sm font-semibold text-gold-soft hover:text-gold">
            <ArrowLeft className="h-4 w-4" /> Library
          </button>
          <button onClick={handleShare} aria-label="Share" className="rounded-full p-2 text-gold-soft hover:bg-secondary hover:text-gold">
            <Share2 className="h-5 w-5" />
          </button>
        </header>

        <section className="mt-12 text-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-gradient-gold shadow-gold animate-float-slow">
            <Sparkles className="h-16 w-16 text-primary-foreground" />
          </div>
          <h1 className="mt-8 font-display text-3xl font-black leading-tight text-gold sm:text-4xl">
            {story.title || "Tonight's story"}
          </h1>
          <p className="mt-2 text-sm text-cream/70">In your voice ✨</p>
        </section>

        {/* Player */}
        <div className="mt-12 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          {audioSrc ? (
            <>
              <audio
                ref={audioRef}
                src={audioSrc}
                preload="metadata"
                onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => setPlaying(false)}
              />
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-gradient-gold transition-all"
                  style={{ width: duration ? `${(time / duration) * 100}%` : "0%" }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-cream/60">
                <span>{formatTime(time)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              <button
                onClick={toggle}
                aria-label={playing ? "Pause" : "Play"}
                className="mx-auto mt-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-gold shadow-gold transition-transform hover:scale-105 active:scale-95"
              >
                {playing ? (
                  <Pause className="h-10 w-10 text-primary-foreground" fill="currentColor" />
                ) : (
                  <Play className="h-10 w-10 text-primary-foreground" fill="currentColor" />
                )}
              </button>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center">
              <p className="text-sm text-cream/70">Audio isn't ready yet.</p>
              <Button
                onClick={() => navigate(`/preview/${story.id}`)}
                className="mt-4 h-12 rounded-2xl bg-gradient-gold text-sm font-bold text-primary-foreground"
              >
                Review &amp; narrate
              </Button>
            </div>
          )}
        </div>

        {/* Story text */}
        <details className="mt-10 rounded-2xl border border-border bg-card/40 p-4 backdrop-blur-sm">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-gold-soft">
            Read along
          </summary>
          <div className="mt-3 whitespace-pre-wrap font-display text-[15px] leading-relaxed text-cream">
            {story.edited_text ?? story.original_text}
          </div>
        </details>
      </div>
    </main>
  );
};

export default StoryPlayer;
