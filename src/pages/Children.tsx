import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AddChildDialog } from "@/components/AddChildDialog";
import { toast } from "sonner";

type Child = {
  id: string;
  name: string;
  age: number;
  avatar: string;
};

const ANIMALS: { key: string; label: string; emoji: string }[] = [
  { key: "cat", label: "Kitten", emoji: "🐱" },
  { key: "fox", label: "Fox", emoji: "🦊" },
  { key: "bear", label: "Bear", emoji: "🐻" },
  { key: "panda", label: "Panda", emoji: "🐼" },
  { key: "rabbit", label: "Bunny", emoji: "🐰" },
  { key: "owl", label: "Owl", emoji: "🦉" },
  { key: "frog", label: "Frog", emoji: "🐸" },
  { key: "lion", label: "Lion", emoji: "🦁" },
];

const Children = () => {
  const navigate = useNavigate();
  const [loadingList, setLoadingList] = useState(true);
  const [children, setChildren] = useState<Child[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    document.title = "Child profiles · Kissa";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Add your little dreamers to Kissa. Up to two child profiles with cute animal avatars.");
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/", { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("children")
        .select("id, name, age, avatar")
        .order("created_at", { ascending: true });
      if (error) {
        toast.error("Couldn't load profiles");
      } else {
        setChildren(data ?? []);
      }
      setLoadingList(false);
    };
    load();
  }, [navigate]);

  const handleDelete = async (id: string, childName: string) => {
    const prev = children;
    setChildren((c) => c.filter((x) => x.id !== id));
    const { error } = await supabase.from("children").delete().eq("id", id);
    if (error) {
      setChildren(prev);
      toast.error("Couldn't remove profile");
    } else {
      toast.success(`${childName}'s profile removed`);
    }
  };

  const slots = [0, 1];
  const canAdd = children.length < 2;

  return (
    <AppShell>
      <div className="flex items-center justify-between animate-fade-up">
        <Link to="/home" className="flex items-center gap-1 text-sm font-semibold text-gold-soft hover:text-gold">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-display text-xl font-bold tracking-tight text-gold">Kissa</span>
        </div>
      </div>

      <section className="mt-6 text-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
        <h1 className="font-display text-4xl font-black leading-[1.05] text-gold sm:text-5xl">
          Who's coming<br />on the journey?
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-cream/75">
          Add up to two little dreamers. Each one picks their own cuddly companion.
        </p>
      </section>

      <div className="mt-8 grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
        {slots.map((idx) => {
          const child = children[idx];
          if (child) {
            const animal = ANIMALS.find((a) => a.key === child.avatar) ?? ANIMALS[0];
            return (
              <div
                key={child.id}
                className="relative rounded-3xl bg-card/70 shadow-soft backdrop-blur-sm border border-border hover:border-gold/60 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/story/new?childId=${child.id}`)}
                  aria-label={`Select ${child.name}`}
                  className="flex w-full flex-col items-center gap-2 rounded-3xl p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-gold text-5xl shadow-gold animate-float-slow">
                    {animal.emoji}
                  </div>
                  <p className="font-display text-lg font-bold text-cream">{child.name}</p>
                  <p className="text-xs uppercase tracking-widest text-gold-soft">{child.age} years</p>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(child.id, child.name); }}
                  aria-label={`Remove ${child.name}`}
                  className="absolute right-2 top-2 z-10 rounded-full p-1.5 text-cream/60 hover:bg-destructive/20 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          }
          return (
            <button
              key={`empty-${idx}`}
              onClick={() => canAdd && setDialogOpen(true)}
              disabled={loadingList || !canAdd}
              className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border bg-card/30 p-4 text-cream/60 transition-colors hover:border-gold/60 hover:bg-card/50 hover:text-gold disabled:opacity-50"
            >
              {loadingList ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                    <Plus className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-semibold">Add a child</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {!canAdd && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Two profiles is plenty — Kissa likes a cozy crowd.
        </p>
      )}

      <AddChildDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdded={(c) => setChildren((prev) => [...prev, { id: c.id, name: c.name, age: c.age, avatar: c.avatar }])}
      />
    </AppShell>
  );
};

export default Children;
