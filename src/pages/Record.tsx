import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Pause, Play, RotateCcw, Sparkles, Square, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:<mime>;base64,"
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const MAX_SECONDS = 30;
const BAR_COUNT = 32;

type Phase = "idle" | "recording" | "done";

const Stars = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    {[
      { top: "8%", left: "12%", size: 6, delay: "0s" },
      { top: "14%", left: "82%", size: 4, delay: "0.6s" },
      { top: "30%", left: "6%", size: 3, delay: "1.2s" },
      { top: "44%", left: "90%", size: 4, delay: "1.8s" },
      { top: "70%", left: "94%", size: 5, delay: "1.5s" },
      { top: "86%", left: "20%", size: 4, delay: "2.1s" },
    ].map((s, i) => (
      <span
        key={i}
        className="absolute rounded-full animate-twinkle"
        style={{
          top: s.top,
          left: s.left,
          width: s.size,
          height: s.size,
          animationDelay: s.delay,
          boxShadow: "0 0 12px hsl(var(--gold) / 0.7)",
          backgroundColor: "hsl(var(--gold-soft))",
        }}
      />
    ))}
  </div>
);

const Record = () => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0); // ms
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0.08));
  const [transcript, setTranscript] = useState<string>("");
  const [story, setStory] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    document.title = "Record your voice · Kissa";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Record a 30-second voice greeting for your child in Kissa.");
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setElapsed(0);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      toast.error("We need microphone access to record.");
      return;
    }
    streamRef.current = stream;

    // MediaRecorder
    const mimeType =
      MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setAudioBlob(blob);
      setPhase("done");
      setLevels(new Array(BAR_COUNT).fill(0.08));
      cleanup();
    };

    // Web Audio analyser for waveform
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.7;
    analyserRef.current = analyser;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      const now = performance.now();
      const ms = now - startTimeRef.current;
      setElapsed(ms);

      analyser.getByteFrequencyData(buffer);
      // Sample BAR_COUNT bars from buffer
      const bars: number[] = [];
      const step = Math.floor(buffer.length / BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += buffer[i * step + j];
        const avg = sum / step / 255;
        bars.push(Math.max(0.08, Math.min(1, avg * 1.4)));
      }
      setLevels(bars);

      if (ms >= MAX_SECONDS * 1000) {
        stopRecording();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    setPhase("recording");
    startTimeRef.current = performance.now();
    recorder.start(100);
    rafRef.current = requestAnimationFrame(tick);
  }, [audioUrl, cleanup, stopRecording]);

  const handleReRecord = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setAudioBlob(null);
    setTranscript("");
    setStory("");
    setElapsed(0);
    setIsPlaying(false);
    setPhase("idle");
  };

  const handleGenerateStory = async () => {
    if (!audioBlob) return;
    setIsGenerating(true);
    setTranscript("");
    setStory("");
    try {
      const mime = audioBlob.type || "audio/webm";
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : "webm";
      const formData = new FormData();
      formData.append("audio", audioBlob, `recording.${ext}`);

      const { data: tData, error: tErr } = await supabase.functions.invoke("transcribe-recording", {
        body: formData,
      });
      if (tErr) throw new Error(tErr.message || "Transcription failed");
      const text = (tData?.transcript ?? "").toString().trim();
      if (!text) throw new Error("We couldn't hear any words — try recording again.");
      setTranscript(text);

      // Pull child info if available
      let childName: string | undefined;
      let childAge: number | undefined;
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes?.user) {
        const { data: kids } = await supabase
          .from("children")
          .select("name, age")
          .eq("parent_user_id", userRes.user.id)
          .order("created_at", { ascending: true })
          .limit(1);
        if (kids && kids.length > 0) {
          childName = kids[0].name;
          childAge = kids[0].age;
        }
      }

      const { data: sData, error: sErr } = await supabase.functions.invoke("generate-story", {
        body: { transcript: text, childName, childAge },
      });
      if (sErr) {
        const msg = sErr.message || "Story generation failed";
        if (msg.includes("429")) throw new Error("Too many requests — try again in a moment.");
        if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits in Workspace → Usage.");
        throw new Error(msg);
      }
      setStory((sData?.story ?? "").toString());
      toast.success("Your bedtime story is ready ✨");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  // Progress ring math
  const size = 264;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(elapsed / (MAX_SECONDS * 1000), 1);
  const dashOffset = circumference * (1 - progress);
  const remaining = Math.max(0, MAX_SECONDS - Math.floor(elapsed / 1000));

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
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <span className="font-display text-xl font-bold tracking-tight text-gold">Kissa</span>
          </div>
        </header>

        <section className="mt-6 text-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <h1 className="font-display text-4xl font-black leading-[1.05] text-gold sm:text-5xl">
            {phase === "done" ? "Sounds lovely!" : "Record your voice"}
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-cream/75">
            {phase === "idle" && "Tap the moon to record up to 30 seconds of love for your little one."}
            {phase === "recording" && "Speak softly — Kissa is listening."}
            {phase === "done" && "Have a listen, then keep it or record again."}
          </p>
        </section>

        {/* Recorder */}
        <div className="mt-10 flex flex-col items-center animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative" style={{ width: size, height: size }}>
            {/* Pulsing aura */}
            {phase === "recording" && (
              <>
                <div className="absolute inset-0 rounded-full bg-gold/15 animate-ping" />
                <div className="absolute inset-4 rounded-full bg-gold/10 animate-ping" style={{ animationDelay: "0.4s" }} />
              </>
            )}

            {/* Progress ring */}
            <svg width={size} height={size} className="absolute inset-0 -rotate-90">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="hsl(var(--indigo-soft))"
                strokeWidth={stroke}
                fill="none"
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="hsl(var(--gold))"
                strokeWidth={stroke}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{
                  transition: phase === "recording" ? "stroke-dashoffset 0.1s linear" : "stroke-dashoffset 0.4s ease",
                  filter: "drop-shadow(0 0 12px hsl(var(--gold) / 0.5))",
                }}
              />
            </svg>

            {/* Center button */}
            <button
              type="button"
              onClick={() => {
                if (phase === "idle") startRecording();
                else if (phase === "recording") stopRecording();
                else handleReRecord();
              }}
              aria-label={
                phase === "idle" ? "Start recording" : phase === "recording" ? "Stop recording" : "Record again"
              }
              className={cn(
                "absolute left-1/2 top-1/2 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all active:scale-95",
                phase === "recording"
                  ? "bg-gradient-to-br from-kitten to-destructive shadow-gold"
                  : "bg-gradient-gold shadow-gold hover:scale-[1.03]",
              )}
              style={{ backgroundImage: phase !== "recording" ? "var(--gradient-gold)" : undefined }}
            >
              {phase === "idle" && <Mic className="h-16 w-16 text-primary-foreground" strokeWidth={2.2} />}
              {phase === "recording" && <Square className="h-12 w-12 text-primary-foreground" fill="currentColor" />}
              {phase === "done" && <RotateCcw className="h-14 w-14 text-primary-foreground" strokeWidth={2.2} />}
            </button>
          </div>

          {/* Countdown */}
          <div className="mt-6 text-center">
            <p className="font-display text-3xl font-bold text-gold tabular-nums">
              0:{String(remaining).padStart(2, "0")}
            </p>
            <p className="mt-1 text-xs uppercase tracking-widest text-gold-soft">
              {phase === "recording" ? "Remaining" : `Up to ${MAX_SECONDS}s`}
            </p>
          </div>

          {/* Waveform */}
          <div className="mt-8 flex h-24 w-full max-w-sm items-center justify-center gap-[3px] rounded-2xl bg-card/40 px-4 backdrop-blur-sm border border-border">
            {levels.map((lvl, i) => (
              <span
                key={i}
                className={cn(
                  "w-1.5 rounded-full transition-all",
                  phase === "recording" ? "bg-gold" : "bg-gold-soft/50",
                )}
                style={{
                  height: `${Math.max(6, lvl * 88)}px`,
                  boxShadow: phase === "recording" ? "0 0 6px hsl(var(--gold) / 0.5)" : undefined,
                  transitionDuration: "80ms",
                }}
              />
            ))}
          </div>

          {/* Done controls */}
          {phase === "done" && audioUrl && (
            <div className="mt-8 w-full space-y-3 animate-fade-up">
              <audio
                ref={audioElRef}
                src={audioUrl}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                className="hidden"
              />
              <Button
                type="button"
                onClick={togglePlay}
                className="h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isPlaying ? (
                  <>
                    <Pause className="mr-2 h-5 w-5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-5 w-5" /> Play recording
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handleGenerateStory}
                disabled={isGenerating}
                className="h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Weaving your story…
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-5 w-5" /> Turn into a bedtime story
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handleReRecord}
                variant="outline"
                className="h-14 w-full rounded-2xl border-2 border-border bg-secondary/60 text-base font-semibold text-cream hover:bg-secondary"
              >
                <RotateCcw className="mr-2 h-5 w-5" /> Re-record
              </Button>
            </div>
          )}

          {(transcript || story) && (
            <div className="mt-8 w-full space-y-4 animate-fade-up">
              {transcript && (
                <div className="rounded-2xl border border-border bg-card/50 p-5 backdrop-blur-sm">
                  <p className="mb-2 text-xs uppercase tracking-widest text-gold-soft">What you said</p>
                  <p className="text-sm leading-relaxed text-cream/90">{transcript}</p>
                </div>
              )}
              {story && (
                <div className="rounded-2xl border-2 border-gold/40 bg-gradient-to-br from-card/70 to-secondary/40 p-5 shadow-gold backdrop-blur-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" />
                    <p className="text-xs uppercase tracking-widest text-gold">A Kissa story for tonight</p>
                  </div>
                  <div className="space-y-3 font-display text-[15px] leading-relaxed text-cream whitespace-pre-wrap">
                    {story}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Record;
