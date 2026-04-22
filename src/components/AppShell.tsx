import { Link, useLocation } from "react-router-dom";
import { BookOpen, Home, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/library", icon: BookOpen, label: "Library" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface Props {
  children: React.ReactNode;
  hideNav?: boolean;
}

export const Stars = () => (
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

export const AppHeader = () => (
  <header className="flex items-center justify-between animate-fade-up">
    <Link to="/home" className="flex items-center gap-2">
      <Sparkles className="h-5 w-5 text-gold" />
      <span className="font-display text-xl font-bold tracking-tight text-gold">Kissa</span>
    </Link>
  </header>
);

export const AppShell = ({ children, hideNav }: Props) => {
  const location = useLocation();
  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-gradient-aurora pb-24">
      <Stars />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "hsl(var(--gold) / 0.6)" }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-6 pt-8 sm:max-w-lg">
        {children}
      </div>

      {!hideNav && (
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-md items-center justify-around border-t border-border/60 bg-indigo-deep/90 px-3 py-2 backdrop-blur sm:max-w-lg"
        >
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to || location.pathname.startsWith(`${to}/`);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                  active ? "text-gold" : "text-cream/60 hover:text-cream",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_hsl(var(--gold)/0.7)]")} />
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </main>
  );
};
