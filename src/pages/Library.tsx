import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader, AppShell } from "@/components/AppShell";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { deleteStory, listChildren, listStories, type Child, type Story } from "@/lib/supabaseService";
import { cn } from "@/lib/utils";

const Library = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [filter, setFilter] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Library · Kissa";
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([listStories(user.id), listChildren(user.id)])
      .then(([s, c]) => { setStories(s); setChildren(c); })
      .finally(() => setLoading(false));
  }, [user]);

  const handleDelete = async (id: string) => {
    const prev = stories;
    setStories((s) => s.filter((x) => x.id !== id));
    try {
      await deleteStory(id);
      toast.success("Story removed");
    } catch {
      setStories(prev);
      toast.error("Couldn't delete");
    }
  };

  const visible = filter === "all" ? stories : stories.filter((s) => s.child_id === filter);
  const childById = (id: string) => children.find((c) => c.id === id);

  return (
    <AppShell>
      <AppHeader />

      <section className="mt-6 animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <p className="text-xs uppercase tracking-widest text-gold-soft">Library</p>
        <h1 className="mt-1 font-display text-3xl font-black leading-[1.05] text-gold sm:text-4xl">
          All our stories
        </h1>
      </section>

      {children.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2 animate-fade-up">
          <FilterChip label="All" active={filter === "all"} onClick={() => setFilter("all")} />
          {children.map((c) => (
            <FilterChip key={c.id} label={c.name} active={filter === c.id} onClick={() => setFilter(c.id)} />
          ))}
        </div>
      )}

      <div className="mt-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gold" /></div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-cream/50" />
            <p className="mt-3 text-sm text-cream/70">No stories yet. Let's weave the first one.</p>
            <Button asChild className="mt-5 h-12 rounded-2xl bg-gradient-gold text-sm font-bold text-primary-foreground shadow-gold">
              <Link to="/story/new"><Wand2 className="mr-2 h-4 w-4" /> Create a story</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((s) => {
              const child = childById(s.child_id);
              return (
                <li key={s.id} className="group flex items-center gap-3 rounded-2xl bg-card/60 p-4 backdrop-blur-sm border border-border hover:border-gold/40 transition-colors">
                  <Link
                    to={s.status === "ready" ? `/play/${s.id}` : `/preview/${s.id}`}
                    className="flex flex-1 items-center gap-3"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                      <Sparkles className="h-5 w-5 text-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-base font-bold text-cream">
                        {s.title || s.theme || "Untitled story"}
                      </p>
                      <p className="text-xs text-cream/60">
                        {child?.name ?? "—"} · {s.status === "ready" ? "Ready" : s.status === "draft" ? "Draft" : s.status}
                        {s.played_count > 0 ? ` · played ${s.played_count}×` : ""}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDelete(s.id)}
                    aria-label="Delete"
                    className="rounded-full p-2 text-cream/50 hover:bg-destructive/20 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
};

const FilterChip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
      active ? "bg-gradient-gold text-primary-foreground shadow-gold" : "bg-secondary text-cream/80 hover:bg-secondary/70",
    )}
  >
    {label}
  </button>
);

export default Library;
