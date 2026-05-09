import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, CheckCircle2, Play, Square, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stars } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NARRATOR_VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "Warm & captivating — our favourite", badge: "Recommended" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", desc: "Calm & gentle — perfect for bedtime" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", desc: "Deep & British — great for adventures" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", desc: "Warm & emotional — soft and soothing" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", desc: "Deep & calm — classic bedtime voice" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", desc: "Confident & strong — energetic stories" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", desc: "Raspy & engaging — fun adventures" },
  { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", desc: "Pleasant & British — gentle fairy tales" },
] as const;

const CHARACTER_VOICES = [
  { id: "xwUbPOIZ6ZbN2HDwIH9H", emoji: "🐰", name: "Squeaky Rabbit", desc: "Bouncy and excited — children love it" },
  { id: "DV4mEkJgV8ZwNCOrjF7L", emoji: "🐻", name: "Grumpy Bear", desc: "Deep and lovable — secretly warm-hearted" },
  { id: "9m6m0XokgtJFpqsimBiN", emoji: "🐒", name: "Giggly Monkey", desc: "Fast-talking and chaotic — pure fun" },
  { id: "AVYJxaX5Uon5HKPfdVo9", emoji: "🐭", name: "Tiny Mouse", desc: "Adorably squeaky — instantly funny" },
] as const;

const PREVIEW_TEXT = "Once upon a time, in a land far away...";
const CHARACTER_PREVIEW_TEXT = "Hello! I will tell your story tonight!";

const Record = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Narrator voice state
  const [savedVoiceId, setSavedVoiceId] = useState<string>("JBFqnCBsd6RMkjVDRZzb");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("JBFqnCBsd6RMkjVDRZzb");
  const [savingVoice, setSavingVoice] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    document.title = "Voice personalisation · Kissa";
  }, []);

  // Pre-fill email, check waitlist, load saved narrator voice
  useEffect(() => {
    if (!user) return;
    if (user.email) setEmail(user.email);

    supabase
      .from("voice_waitlist")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSubmitted(true);
      });

    supabase
      .from("profiles")
      .select("narrator_voice_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.narrator_voice_id) {
          setSavedVoiceId(data.narrator_voice_id);
          setSelectedVoiceId(data.narrator_voice_id);
        }
      });
  }, [user]);

  const handleSubmit = async () => {
    if (!user) return;
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("voice_waitlist")
        .insert({ email: trimmed, user_id: user.id });
      if (error) {
        if (error.code === "23505") {
          setSubmitted(true);
        } else {
          throw error;
        }
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPreview = async (voiceId: string, text: string = PREVIEW_TEXT) => {
    // If already playing this voice, stop
    if (playingVoiceId === voiceId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingVoiceId(null);
      return;
    }

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPlayingVoiceId(voiceId);
    try {
      const { data, error } = await supabase.functions.invoke("synthesize-voice", {
        body: { storyText: text, voiceId },
      });
      if (error) throw new Error(error.message || "Preview failed");
      const audioUrl = data?.audioUrl;
      if (!audioUrl) throw new Error("No audio returned");

      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingVoiceId(null);
        audioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      toast.error("Couldn't play preview — try again");
      setPlayingVoiceId(null);
    }
  };

  const handleSaveVoice = async () => {
    if (!user) return;
    setSavingVoice(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ narrator_voice_id: selectedVoiceId })
        .eq("user_id", user.id);
      if (error) throw error;
      setSavedVoiceId(selectedVoiceId);
      toast.success("Narrator voice saved — your next story will use this voice.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save voice");
    } finally {
      setSavingVoice(false);
    }
  };

  const hasChanges = selectedVoiceId !== savedVoiceId;

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
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm font-semibold text-gold-soft hover:text-gold"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <span className="font-display text-lg font-bold text-gold">Kissa</span>
          </div>
        </header>

        <section
          className="mt-10 flex flex-1 flex-col items-center text-center animate-fade-up"
          style={{ animationDelay: "0.05s" }}
        >
          <div className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-gradient-gold shadow-gold">
            <Sparkles className="h-14 w-14 text-primary-foreground" strokeWidth={2.2} />
          </div>

          <span className="mb-4 inline-flex items-center gap-1 rounded-full bg-card/60 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
            Beta
          </span>

          <h1 className="font-display text-3xl font-black leading-[1.1] text-gold sm:text-4xl">
            Voice personalisation coming soon
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-base text-cream/80">
            Your stories will be narrated in a warm storytelling voice during beta. We'll re-enable
            custom voice cloning very soon ✨
          </p>

          {submitted ? (
            <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur-sm animate-fade-up">
              <CheckCircle2 className="h-8 w-8 text-gold" />
              <p className="max-w-xs text-sm font-semibold text-cream">
                You're on the list! We'll email you the moment your voice recording is ready.
              </p>
            </div>
          ) : (
            <div className="mt-8 flex w-full max-w-sm flex-col gap-3 animate-fade-up">
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 rounded-2xl border-border bg-card/60 px-5 text-base text-cream placeholder:text-cream/40 backdrop-blur-sm"
              />
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {loading ? "Saving…" : "Notify me when it's ready"}
              </Button>
            </div>
          )}

          {/* Narrator voices section */}
          <div className="mt-12 w-full max-w-sm text-left animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="font-display text-xl font-bold text-gold">Narrator voices</h2>
            <p className="mt-1 text-sm text-cream/60">Choose the voice that tells your child's stories.</p>

            <div className="mt-5 flex flex-col gap-3">
              {NARRATOR_VOICES.map((voice) => {
                const isSelected = selectedVoiceId === voice.id;
                const isPlaying = playingVoiceId === voice.id;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setSelectedVoiceId(voice.id)}
                    className={`relative flex items-center gap-3 rounded-2xl border-2 p-4 text-left backdrop-blur-sm transition-all ${
                      isSelected
                        ? "border-gold bg-card/80 shadow-gold/20 shadow-md"
                        : "border-border bg-card/60 hover:border-gold/40"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <Check className="h-4 w-4 text-gold" />
                      </div>
                    )}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPreview(voice.id);
                      }}
                    >
                      {isPlaying ? (
                        <Square className="h-5 w-5 text-gold fill-gold" />
                      ) : (
                        <Play className="h-5 w-5 text-gold fill-gold" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-cream">{voice.name}</span>
                        {"badge" in voice && voice.badge && (
                          <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
                            {voice.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-cream/60">{voice.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {hasChanges && (
              <Button
                type="button"
                onClick={handleSaveVoice}
                disabled={savingVoice}
                className="mt-5 h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] animate-fade-up"
              >
                {savingVoice ? "Saving…" : "Save narrator voice"}
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/home")}
            className="mt-6 h-14 w-full max-w-sm rounded-2xl border-2 border-border bg-secondary/60 text-base font-semibold text-cream hover:bg-secondary"
          >
            Back to home
          </Button>
        </section>
      </div>
    </main>
  );
};

export default Record;
