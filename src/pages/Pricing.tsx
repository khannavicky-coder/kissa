import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { AppShell, Stars } from "@/components/AppShell";
import { cn } from "@/lib/utils";

interface Tier {
  name: string;
  uae: string;
  india: string;
  cadence: string;
  features: string[];
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    uae: "AED 0", india: "₹ 0", cadence: "forever",
    features: ["1 child profile", "3 stories per month", "Default narrator voice"],
  },
  {
    name: "Monthly",
    uae: "AED 29", india: "₹ 499", cadence: "/ month", highlight: true,
    features: ["2 child profiles", "Unlimited stories", "Your cloned voice", "Story library"],
  },
  {
    name: "Annual",
    uae: "AED 249", india: "₹ 3,999", cadence: "/ year",
    features: ["Everything in Monthly", "2 months free", "Early access to new features"],
  },
  {
    name: "Family",
    uae: "AED 499", india: "₹ 7,999", cadence: "/ year",
    features: ["Up to 4 children", "Multiple cloned voices", "Priority support"],
  },
];

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Pricing · Kissa";
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-aurora">
      <Stars />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-8 sm:max-w-lg">
        <header className="flex items-center justify-between animate-fade-up">
          <Link to="/settings" className="flex items-center gap-1 text-sm font-semibold text-gold-soft hover:text-gold">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <span className="font-display text-lg font-bold text-gold">Kissa</span>
          </div>
        </header>

        <section className="mt-6 text-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <h1 className="font-display text-4xl font-black leading-[1.05] text-gold sm:text-5xl">
            A plan for every nest
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-cream/75">
            Start free. Upgrade when you fall in love with story time.
          </p>
        </section>

        <div className="mt-8 space-y-4 pb-6">
          {TIERS.map((t, i) => (
            <article
              key={t.name}
              className={cn(
                "rounded-3xl border bg-card/60 p-5 backdrop-blur-sm animate-fade-up",
                t.highlight ? "border-gold/60 shadow-gold" : "border-border",
              )}
              style={{ animationDelay: `${0.1 + i * 0.05}s` }}
            >
              {t.highlight && (
                <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-gradient-gold px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-foreground shadow-gold">
                  <Sparkles className="h-3 w-3" /> Most loved
                </div>
              )}
              <h2 className="font-display text-2xl font-bold text-gold">{t.name}</h2>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-3xl font-black text-cream">{t.uae}</span>
                <span className="text-xs text-cream/60">{t.cadence}</span>
              </div>
              <p className="text-xs text-cream/50">or {t.india} {t.cadence}</p>

              <ul className="mt-4 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-cream/85">
                    <Check className="mt-0.5 h-4 w-4 flex-none text-gold" /> {f}
                  </li>
                ))}
              </ul>

              <button
                disabled
                className={cn(
                  "mt-5 h-12 w-full rounded-2xl text-sm font-bold transition-transform",
                  t.highlight
                    ? "bg-gradient-gold text-primary-foreground shadow-gold opacity-70"
                    : "bg-secondary text-cream/70 opacity-70",
                )}
              >
                Coming soon
              </button>
            </article>
          ))}
        </div>

        <p className="mb-6 text-center text-xs text-muted-foreground">
          Payments aren't enabled yet. We'll let you know the moment they go live.
        </p>
      </div>
    </main>
  );
};

export default Pricing;
