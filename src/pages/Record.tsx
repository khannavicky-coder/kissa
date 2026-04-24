import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/AppShell";


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

      if (data.fallback) {
        toast.success("Using a shared default voice for now ✨", {
          description: "Voice cloning needs an ElevenLabs paid plan. Stories will still sound great!",
        });
      } else {
        toast.success("Your voice is ready ✨");
      }
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

        <section className="mt-10 flex flex-1 flex-col items-center justify-center text-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
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
            Your stories will be narrated in a warm storytelling voice during beta. We'll re-enable custom voice cloning very soon ✨
          </p>

          <Button
            type="button"
            onClick={() => navigate("/home")}
            className="mt-10 h-14 w-full max-w-sm rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Back to home
          </Button>
        </section>
      </div>
    </main>
  );
};

export default Record;
