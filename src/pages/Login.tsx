import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Apple, Loader2, Mail, Sparkles } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Stars } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1S8.69 6 12 6c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.86 3.42 14.65 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12S6.76 21.5 12 21.5c6.93 0 9.5-4.86 9.5-9.34 0-.63-.07-1.1-.17-1.96H12z" />
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState<"email" | "google" | "apple" | null>(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  useEffect(() => {
    document.title = "Sign in · Kissa";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Sign in to your Kissa account.");
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      const from = (location.state as { from?: string } | null)?.from ?? "/home";
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, location.state]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const fe: Partial<Record<keyof typeof form, string>> = {};
      result.error.issues.forEach((i) => {
        fe[i.path[0] as keyof typeof form] = i.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});
    setLoading("email");
    const { error } = await supabase.auth.signInWithPassword({
      email: result.data.email,
      password: result.data.password,
    });
    setLoading(null);
    if (error) {
      toast.error(error.message.includes("Invalid") ? "Wrong email or password." : error.message);
      return;
    }
    toast.success("Welcome back ✨");
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setLoading(provider);
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/home`,
    });
    if (error) {
      setLoading(null);
      toast.error(error.message);
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
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <span className="font-display text-xl font-bold tracking-tight text-gold">Kissa</span>
          </div>
          <Link to="/" className="text-sm font-semibold text-gold-soft hover:text-gold transition-colors">
            Sign up
          </Link>
        </header>

        <section className="mt-12 text-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <h1 className="font-display text-4xl font-black leading-[1.05] text-gold sm:text-5xl">
            Welcome back
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-cream/75">
            The little ones have been waiting for tonight's story.
          </p>
        </section>

        <form onSubmit={handleEmailSignIn} className="mt-8 space-y-3 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              autoComplete="email"
              className="h-12 rounded-xl border-2 border-border bg-input/60 px-4 text-base text-foreground placeholder:text-muted-foreground/60"
            />
            {errors.email && <p className="text-xs font-medium text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-12 rounded-xl border-2 border-border bg-input/60 px-4 text-base text-foreground placeholder:text-muted-foreground/60"
            />
            {errors.password && <p className="text-xs font-medium text-destructive">{errors.password}</p>}
          </div>

          <Button
            type="submit"
            disabled={loading !== null}
            className="mt-2 h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
          >
            {loading === "email" ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><Mail className="mr-2 h-5 w-5" /> Sign in</>)}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <Button
            type="button"
            onClick={() => handleOAuth("apple")}
            disabled={loading !== null}
            className="h-14 w-full rounded-2xl bg-cream text-base font-semibold text-indigo-deep shadow-soft hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
            style={{ backgroundColor: "hsl(var(--cream))", color: "hsl(var(--indigo-deep))" }}
          >
            {loading === "apple" ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><Apple className="mr-2 h-5 w-5" /> Continue with Apple</>)}
          </Button>
          <Button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={loading !== null}
            variant="outline"
            className="h-14 w-full rounded-2xl border-2 border-border bg-secondary text-base font-semibold text-foreground hover:bg-secondary/80"
          >
            {loading === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><GoogleIcon /> <span className="ml-2">Continue with Google</span></>)}
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          New to Kissa?{" "}
          <Link to="/" className="text-gold-soft underline-offset-2 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
};

export default Login;
