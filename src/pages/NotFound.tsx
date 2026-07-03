import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

const SleepingMoon = () => (
  <svg
    viewBox="0 0 120 120"
    className="mx-auto h-32 w-32 animate-float-slow"
    aria-hidden="true"
    fill="none"
  >
    <circle cx="60" cy="60" r="44" fill="hsl(var(--gold-soft))" fillOpacity="0.15" />
    <path
      d="M72 28c-12 0-22 10-22 22s10 22 22 22c-9 0-17-7-17-17s8-16 17-16c-6 0-10-4-10-10 0-6 4-10 10-10z"
      fill="hsl(var(--gold))"
      fillOpacity="0.9"
    />
    <circle cx="78" cy="54" r="4" fill="hsl(var(--indigo-deep))" fillOpacity="0.7" />
    <path
      d="M82 60c-2 4-6 6-8 6"
      stroke="hsl(var(--indigo-deep))"
      strokeWidth="2.5"
      strokeLinecap="round"
      fillOpacity="0.6"
    />
    <circle cx="40" cy="44" r="2" fill="hsl(var(--cream))" fillOpacity="0.6" />
    <circle cx="32" cy="72" r="2.5" fill="hsl(var(--cream))" fillOpacity="0.5" />
    <circle cx="88" cy="88" r="2" fill="hsl(var(--cream))" fillOpacity="0.55" />
    <circle cx="52" cy="96" r="1.5" fill="hsl(var(--cream))" fillOpacity="0.4" />
  </svg>
);

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-aurora px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-night)", backgroundAttachment: "fixed" }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full animate-twinkle"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: 2 + Math.random() * 4,
              height: 2 + Math.random() * 4,
              animationDelay: `${Math.random() * 3}s`,
              boxShadow: "0 0 12px hsl(var(--gold) / 0.7)",
              backgroundColor: "hsl(var(--gold-soft))",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <Link to="/home" className="mb-10 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-gold" />
          <span className="font-display text-2xl font-bold tracking-tight text-gold">Kissa</span>
        </Link>

        <SleepingMoon />

        <h1 className="mt-8 font-display text-4xl font-bold text-cream">Lost in the story?</h1>
        <p className="mt-4 text-lg text-cream/70">
          This page wandered off into the night. Let us head home.
        </p>

        <Link
          to="/home"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-gradient-gold px-8 py-3 text-sm font-semibold text-primary-foreground shadow-gold transition-transform hover:scale-105"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
