import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, CreditCard, LogOut, Mic, Sparkles, User2, Users } from "lucide-react";
import { AppHeader, AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getProfile, getVoiceProfile, signOut, type Profile, type VoiceProfile } from "@/lib/supabaseService";

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [voice, setVoice] = useState<VoiceProfile | null>(null);

  useEffect(() => {
    document.title = "Settings · Kissa";
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([getProfile(user.id), getVoiceProfile(user.id)]).then(([p, v]) => {
      setProfile(p); setVoice(v);
    });
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't sign out");
    }
  };

  return (
    <AppShell>
      <AppHeader />

      <section className="mt-6 animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <p className="text-xs uppercase tracking-widest text-gold-soft">Settings</p>
        <h1 className="mt-1 font-display text-3xl font-black leading-[1.05] text-gold sm:text-4xl">
          Your nest
        </h1>
      </section>

      <div className="mt-6 flex items-center gap-4 rounded-3xl bg-card/70 p-5 backdrop-blur-sm border border-border animate-fade-up">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-gold shadow-gold">
          <User2 className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-cream">
            {profile?.parent_name || user?.email?.split("@")[0] || "Parent"}
          </p>
          <p className="truncate text-xs text-cream/60">{user?.email}</p>
        </div>
      </div>

      <div className="mt-5 space-y-2 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        <Row to="/children" icon={Users} title="Children profiles" subtitle="Add or remove little dreamers" />
        <Row
          to="/record"
          icon={Mic}
          title="My voice"
          subtitle={
            voice?.status === "ready"
              ? "Voice ready ✨"
              : voice?.status === "pending"
              ? "Cloning your voice…"
              : voice?.status === "failed"
              ? "Cloning failed — try again"
              : "Record a 30-second sample"
          }
        />
        <Row to="/pricing" icon={CreditCard} title="Plan & billing" subtitle="Free plan" />
      </div>

      <Button
        onClick={handleSignOut}
        variant="outline"
        className="mt-8 h-12 w-full rounded-2xl border-2 border-border bg-secondary/60 text-sm font-semibold text-cream hover:bg-secondary animate-fade-up"
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Sparkles className="mr-1 inline h-3 w-3 text-gold" />
        Kissa · made with love for bedtime
      </p>
    </AppShell>
  );
};

const Row = ({
  to, icon: Icon, title, subtitle,
}: { to: string; icon: typeof Users; title: string; subtitle: string }) => (
  <Link
    to={to}
    className="flex items-center gap-3 rounded-2xl bg-card/60 p-4 backdrop-blur-sm border border-border hover:border-gold/40 transition-colors"
  >
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
      <Icon className="h-5 w-5 text-gold" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate font-display text-base font-bold text-cream">{title}</p>
      <p className="truncate text-xs text-cream/60">{subtitle}</p>
    </div>
    <ChevronRight className="h-4 w-4 text-cream/40" />
  </Link>
);

export default Settings;
