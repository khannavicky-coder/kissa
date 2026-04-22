import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Loader2, Mic, Plus, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader, AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import {
  getProfile,
  getVoiceProfile,
  listChildren,
  listStories,
  type Child,
  type Story,
  type VoiceProfile,
} from "@/lib/supabaseService";

const ANIMAL_EMOJI: Record<string, string> = {
  cat: "🐱", fox: "🦊", bear: "🐻", panda: "🐼", rabbit: "🐰", owl: "🦉", frog: "🐸", lion: "🦁",
};

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState<string>("");
  const [children, setChildren] = useState<Child[]>([]);
  const [voice, setVoice] = useState<VoiceProfile | null>(null);
  const [recentStories, setRecentStories] = useState<Story[]>([]);

  useEffect(() => {
    document.title = "Home · Kissa";
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [prof, kids, vp, stories] = await Promise.all([
          getProfile(user.id),
          listChildren(user.id),
          getVoiceProfile(user.id),
          listStories(user.id),
        ]);
        if (cancelled) return;
        setParentName(prof?.parent_name ?? "");
        setChildren(kids);
        setVoice(vp);
        setRecentStories(stories.slice(0, 3));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const needsChild = !loading && children.length === 0;
  const needsVoice = !loading && (!voice || voice.status !== "ready");

  return (
    <AppShell>
      <AppHeader />

      <section className="mt-6 animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <p className="text-xs uppercase tracking-widest text-gold-soft">Tonight</p>
        <h1 className="mt-1 font-display text-4xl font-black leading-[1.05] text-gold sm:text-5xl">
          Hello{parentName ? `, ${parentName.split(" ")[0]}` : ""} ✨
        </h1>
        <p className="mt-3 text-sm text-cream/75">
          Ready to weave a bedtime story in your own voice?
        </p>
      </section>

      {/* Setup banners */}
      {needsChild && (
        <Link
          to="/children"
          className="mt-6 flex items-center gap-3 rounded-2xl border border-gold/40 bg-card/60 p-4 backdrop-blur-sm animate-fade-up"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-gold shadow-gold">
            <Plus className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-display text-base font-bold text-cream">Add your little dreamer</p>
            <p className="text-xs text-cream/70">A child profile lets us personalise every story.</p>
          </div>
        </Link>
      )}

      {!needsChild && needsVoice && (
        <Link
          to="/record"
          className="mt-6 flex items-center gap-3 rounded-2xl border border-gold/40 bg-card/60 p-4 backdrop-blur-sm animate-fade-up"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-gold shadow-gold">
            <Mic className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-display text-base font-bold text-cream">Record your voice</p>
            <p className="text-xs text-cream/70">30 seconds — so every story sounds like you.</p>
          </div>
        </Link>
      )}

      {/* Children chips */}
      {children.length > 0 && (
        <section className="mt-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <p className="mb-3 text-xs uppercase tracking-widest text-gold-soft">Little dreamers</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/story/new?childId=${c.id}`)}
                className="flex min-w-[120px] flex-col items-center gap-2 rounded-3xl bg-card/70 p-4 backdrop-blur-sm border border-border hover:border-gold/60 transition-colors"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-gold text-3xl shadow-gold">
                  {ANIMAL_EMOJI[c.avatar] ?? "⭐"}
                </div>
                <p className="font-display text-sm font-bold text-cream">{c.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-gold-soft">{c.age} years</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Primary CTA */}
      {!loading && children.length > 0 && (
        <Button
          onClick={() => navigate(`/story/new?childId=${children[0].id}`)}
          className="mt-8 h-16 w-full rounded-3xl bg-gradient-gold text-lg font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] animate-fade-up"
        >
          <Wand2 className="mr-2 h-6 w-6" /> Create tonight's story
        </Button>
      )}

      {/* Recent stories */}
      <section className="mt-10 animate-fade-up" style={{ animationDelay: "0.15s" }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-gold-soft">Recent stories</p>
          <Link to="/library" className="text-xs font-semibold text-gold hover:underline">See all</Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        ) : recentStories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-6 text-center">
            <BookOpen className="mx-auto h-7 w-7 text-cream/50" />
            <p className="mt-3 text-sm text-cream/70">Your library is empty. Tonight is a great night to start.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {recentStories.map((s) => (
              <li key={s.id}>
                <Link
                  to={s.status === "ready" ? `/play/${s.id}` : `/preview/${s.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-card/60 p-4 backdrop-blur-sm border border-border hover:border-gold/40 transition-colors"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                    <Sparkles className="h-5 w-5 text-gold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold text-cream">
                      {s.title || s.theme || "A bedtime story"}
                    </p>
                    <p className="text-xs text-cream/60">
                      {s.status === "ready" ? "Ready to play" : s.status === "draft" ? "Awaiting your review" : s.status}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
};

export default Home;
