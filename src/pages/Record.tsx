import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stars } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Record = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Voice personalisation · Kissa";
  }, []);

  // Pre-fill email and check if already on waitlist
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
          // duplicate – already on list
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
          className="mt-10 flex flex-1 flex-col items-center justify-center text-center animate-fade-up"
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
