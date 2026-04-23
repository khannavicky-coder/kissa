import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Apple, Loader2, Mail, Sparkles } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import kissaHero from "@/assets/kissa-hero.png";

const signUpSchema = z.object({
  parentName: z.string().trim().min(1, "Tell us your name").max(60),
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});

const Stars = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    {[
      { top: "8%", left: "12%", size: 6, delay: "0s" },
      { top: "14%", left: "82%", size: 4, delay: "0.6s" },
      { top: "30%", left: "6%", size: 3, delay: "1.2s" },
      { top: "22%", left: "48%", size: 5, delay: "0.3s" },
      { top: "44%", left: "90%", size: 4, delay: "1.8s" },
      { top: "60%", left: "4%", size: 3, delay: "0.9s" },
      { top: "70%", left: "94%", size: 5, delay: "1.5s" },
      { top: "86%", left: "20%", size: 4, delay: "2.1s" },
      { top: "92%", left: "78%", size: 3, delay: "0.4s" },
    ].map((s, i) => (
      <span
        key={i}
        className="absolute rounded-full bg-gold-soft animate-twinkle"
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

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1S8.69 6 12 6c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.86 3.42 14.65 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12S6.76 21.5 12 21.5c6.93 0 9.5-4.86 9.5-9.34 0-.63-.07-1.1-.17-1.96H12z" />
  </svg>
);

const SignUp = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<"email" | "google" | "apple" | null>(null);
  const [form, setForm] = useState({ parentName: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  useEffect(() => {
    document.title = "Sign up · Kissa — A storybook for little stars";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Create your Kissa parent account to begin a magical bedtime story journey for your child.");
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate("/home", { replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/home", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = signUpSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof typeof form, string>> = {};
      result.error.issues.forEach((i) => {
        const k = i.path[0] as keyof typeof form;
        fieldErrors[k] = i.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading("email");
    const { error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          parent_name: result.data.parentName,
        },
      },
    });
    setLoading(null);
    if (error) {
      toast.error(error.message.includes("registered") ? "This email already has an account." : error.message);
      return;
    }
    toast.success(`Welcome, ${result.data.parentName}! Your Kissa account is ready 🌙`);
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

      {/* Soft moon glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
        style={{ background: "hsl(var(--gold) / 0.6)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-8 sm:max-w-lg">
        {/* Wordmark */}
        <header className="flex items-center justify-between animate-fade-up">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <span className="font-display text-xl font-bold tracking-tight text-gold">Kissa</span>
          </div>
          <Link to="/login" className="text-sm font-semibold text-gold-soft hover:text-gold transition-colors">
            Sign in
          </Link>
        </header>

        {/* Hero illustration */}
        <div className="relative mx-auto mt-4 h-44 w-44 sm:h-52 sm:w-52 animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <img
            src={kissaHero}
            alt="Kissa, an orange cat sitting on a golden crescent moon"
            width={768}
            height={768}
            className="h-full w-full object-contain animate-float-slow drop-shadow-2xl"
          />
        </div>

        {/* Headline */}
        <section className="mt-2 text-center animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <h1 className="font-display text-4xl font-black leading-[1.05] text-gold sm:text-5xl">
            A bedtime world<br />for little dreamers
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-cream/75">
            Create a parent account to unlock cozy stories, songs, and gentle play with Kissa.
          </p>
        </section>

        {/* Form */}
        <form onSubmit={handleEmailSignUp} className="mt-6 space-y-3 animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <Field
            id="parentName"
            label="Your name"
            placeholder="Parent"
            value={form.parentName}
            onChange={(v) => setForm({ ...form, parentName: v })}
            error={errors.parentName}
          />
          <Field
            id="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            error={errors.email}
          />
          <Field
            id="password"
            type="password"
            label="Password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            error={errors.password}
          />

          <Button
            type="submit"
            disabled={loading !== null}
            className="mt-2 h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
          >
            {loading === "email" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Mail className="mr-2 h-5 w-5" /> Create account
              </>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Social */}
        <div className="space-y-3 animate-fade-up" style={{ animationDelay: "0.25s" }}>
          <Button
            type="button"
            onClick={() => handleOAuth("apple")}
            disabled={loading !== null}
            className="h-14 w-full rounded-2xl bg-cream text-base font-semibold text-indigo-deep shadow-soft transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
            style={{ backgroundColor: "hsl(var(--cream))", color: "hsl(var(--indigo-deep))" }}
          >
            {loading === "apple" ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><Apple className="mr-2 h-5 w-5" /> Continue with Apple</>)}
          </Button>
          <Button
            type="button"
            onClick={() => handleOAuth("google")}
            disabled={loading !== null}
            variant="outline"
            className="h-14 w-full rounded-2xl border-2 border-border bg-secondary text-base font-semibold text-foreground hover:bg-secondary/80 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
          >
            {loading === "google" ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><GoogleIcon /> <span className="ml-2">Continue with Google</span></>)}
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground animate-fade-up" style={{ animationDelay: "0.3s" }}>
          By continuing you agree to Kissa's{" "}
          <a href="#" className="text-gold-soft underline-offset-2 hover:underline">Terms</a> &{" "}
          <a href="#" className="text-gold-soft underline-offset-2 hover:underline">Privacy</a>.
        </p>
      </div>
    </main>
  );
};

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
}

const Field = ({ id, label, value, onChange, placeholder, type = "text", error }: FieldProps) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
      {label}
    </Label>
    <Input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={type === "password" ? "new-password" : id === "email" ? "email" : "off"}
      className="h-12 rounded-xl border-2 border-border bg-input/60 px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
    />
    {error && <p className="text-xs font-medium text-destructive">{error}</p>}
  </div>
);

export default SignUp;
