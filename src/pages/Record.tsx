import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Mic, Pause, Play, RotateCcw, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Stars } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { getProfile, getVoiceProfile, type VoiceProfile } from "@/lib/supabaseService";

const MAX_SECONDS = 30;
const BAR_COUNT = 32;
type Phase = "idle" | "recording" | "done";

const Record = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => new Array(BAR_COUNT).fill(0.08));
  const [cloning, setCloning] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);

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
  }, []);

  useEffect(() => {
    if (!user) return;
    getVoiceProfile(user.id).then(setVoiceProfile);
  }, [user]);

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

  useEffect(() => () => { cleanup(); if (audioUrl) URL.revokeObjectURL(audioUrl); }, [cleanup, audioUrl]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
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

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setAudioBlob(blob);
      setPhase("done");
      setLevels(new Array(BAR_COUNT).fill(0.08));
      cleanup();
    };

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
      const ms = performance.now() - startTimeRef.current;
      setElapsed(ms);
      analyser.getByteFrequencyData(buffer);
      const bars: number[] = [];
      const step = Math.floor(buffer.length / BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += buffer[i * step + j];
        bars.push(Math.max(0.08, Math.min(1, (sum / step / 255) * 1.4)));
      }
      setLevels(bars);
      if (ms >= MAX_SECONDS * 1000) { stopRecording(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };

    setPhase("recording");
    startTimeRef.current = performance.now();
    recorder.start(100);
    rafRef.current = requestAnimationFrame(tick);
  }, [audioUrl, cleanup, stopRecording]);

  const handleReRecord = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setElapsed(0);
    setIsPlaying(false);
    setPhase("idle");
  };

  const togglePlay = () => {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setIsPlaying(true); } else { el.pause(); setIsPlaying(false); }
  };

  const handleCloneVoice = async () => {
    if (!audioBlob || !user) return;
    setCloning(true);
    try {
      const profile = await getProfile(user.id);
      const ext = audioBlob.type.includes("mp4") ? "mp4" : audioBlob.type.includes("mpeg") ? "mp3" : "webm";
      const formData = new FormData();
      formData.append("audio", audioBlob, `sample.${ext}`);
      formData.append("name", profile?.parent_name ?? user.email ?? user.id);

      const { data, error } = await supabase.functions.invoke("clone-voice", { body: formData });
      if (error) throw new Error(error.message);
      if (!data?.voiceId) throw new Error("No voice id returned");

      toast.success("Your voice is ready ✨");
      navigate("/home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice cloning failed");
    } finally {
      setCloning(false);
    }
  };

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
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "hsl(var(--gold) / 0.6)" }} />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-8 sm:max-w-lg">
        <header className="flex items-center justify-between animate-fade-up">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-semibold text-gold-soft hover:text-gold">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <span className="font-display text-lg font-bold text-gold">Kissa</span>
          </div>
        </header>

        <section className="mt-6 text-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <h1 className="font-display text-4xl font-black leading-[1.05] text-gold sm:text-5xl">
            {phase === "done" ? "Sounds lovely!" : "Record your voice"}
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-cream/75">
            {phase === "idle" && "Read this aloud for 30 seconds: \"Once upon a time, in a cozy little garden, lived a tiny star who dreamed of bedtime stories…\""}
            {phase === "recording" && "Speak softly — Kissa is listening."}
            {phase === "done" && "Have a listen, then save your voice forever."}
          </p>
          {voiceProfile?.status === "ready" && phase === "idle" && (
            <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-card/60 px-3 py-1 text-xs text-gold">
              <CheckCircle2 className="h-3 w-3" /> Voice already saved — record again to replace
            </p>
          )}
        </section>

        <div className="mt-10 flex flex-col items-center animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="relative" style={{ width: size, height: size }}>
            {phase === "recording" && (
              <>
                <div className="absolute inset-0 rounded-full bg-gold/15 animate-ping" />
                <div className="absolute inset-4 rounded-full bg-gold/10 animate-ping" style={{ animationDelay: "0.4s" }} />
              </>
            )}
            <svg width={size} height={size} className="absolute inset-0 -rotate-90">
              <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--indigo-soft))" strokeWidth={stroke} fill="none" />
              <circle
                cx={size / 2} cy={size / 2} r={radius}
                stroke="hsl(var(--gold))" strokeWidth={stroke} strokeLinecap="round" fill="none"
                strokeDasharray={circumference} strokeDashoffset={dashOffset}
                style={{ transition: phase === "recording" ? "stroke-dashoffset 0.1s linear" : "stroke-dashoffset 0.4s ease", filter: "drop-shadow(0 0 12px hsl(var(--gold) / 0.5))" }}
              />
            </svg>
            <button
              type="button"
              onClick={() => { if (phase === "idle") startRecording(); else if (phase === "recording") stopRecording(); else handleReRecord(); }}
              aria-label={phase === "idle" ? "Start recording" : phase === "recording" ? "Stop recording" : "Record again"}
              className={cn(
                "absolute left-1/2 top-1/2 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all active:scale-95",
                phase === "recording" ? "bg-gradient-to-br from-kitten to-destructive shadow-gold" : "bg-gradient-gold shadow-gold hover:scale-[1.03]",
              )}
              style={{ backgroundImage: phase !== "recording" ? "var(--gradient-gold)" : undefined }}
            >
              {phase === "idle" && <Mic className="h-16 w-16 text-primary-foreground" strokeWidth={2.2} />}
              {phase === "recording" && <Square className="h-12 w-12 text-primary-foreground" fill="currentColor" />}
              {phase === "done" && <RotateCcw className="h-14 w-14 text-primary-foreground" strokeWidth={2.2} />}
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="font-display text-3xl font-bold text-gold tabular-nums">0:{String(remaining).padStart(2, "0")}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-gold-soft">{phase === "recording" ? "Remaining" : `Up to ${MAX_SECONDS}s`}</p>
          </div>

          <div className="mt-8 flex h-24 w-full max-w-sm items-center justify-center gap-[3px] rounded-2xl bg-card/40 px-4 backdrop-blur-sm border border-border">
            {levels.map((lvl, i) => (
              <span
                key={i}
                className={cn("w-1.5 rounded-full transition-all", phase === "recording" ? "bg-gold" : "bg-gold-soft/50")}
                style={{ height: `${Math.max(6, lvl * 88)}px`, boxShadow: phase === "recording" ? "0 0 6px hsl(var(--gold) / 0.5)" : undefined, transitionDuration: "80ms" }}
              />
            ))}
          </div>

          {phase === "done" && audioUrl && (
            <div className="mt-8 w-full space-y-3 animate-fade-up">
              <audio ref={audioElRef} src={audioUrl} onEnded={() => setIsPlaying(false)} onPause={() => setIsPlaying(false)} className="hidden" />
              <Button
                type="button" onClick={togglePlay}
                variant="outline"
                className="h-14 w-full rounded-2xl border-2 border-border bg-secondary/60 text-base font-semibold text-cream hover:bg-secondary"
              >
                {isPlaying ? (<><Pause className="mr-2 h-5 w-5" /> Pause</>) : (<><Play className="mr-2 h-5 w-5" /> Play recording</>)}
              </Button>
              <Button
                type="button" onClick={handleCloneVoice} disabled={cloning}
                className="h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
              >
                {cloning ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving your voice…</>) : (<><CheckCircle2 className="mr-2 h-5 w-5" /> Save my voice</>)}
              </Button>
              <Button
                type="button" onClick={handleReRecord} variant="outline"
                className="h-12 w-full rounded-2xl border-2 border-border bg-secondary/30 text-sm font-semibold text-cream/80 hover:bg-secondary"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Re-record
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default Record;
