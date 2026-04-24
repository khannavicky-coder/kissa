import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/AppShell";

const Record = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Voice personalisation · Kissa";
  }, []);

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
