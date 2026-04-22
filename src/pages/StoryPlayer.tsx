import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pause, Play, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, Stars } from "@/components/AppShell";
import { toast } from "sonner";
import { getStory, incrementPlayCount, type Story } from "@/lib/supabaseService";

const formatTime = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const StoryPlayer = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [counted, setCounted] = useState(false);

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
  }, [id, navigate]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !story?.audio_url) return;
    if (el.paused) {
      await el.play();
      setPlaying(true);
      if (!counted) {
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

  if (loading || !story) {
    return (
      <AppShell hideNav>
        <div className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>
      </AppShell>
    );
  }

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
          {story.audio_url ? (
            <>
              <audio
                ref={audioRef}
                src={story.audio_url}
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
