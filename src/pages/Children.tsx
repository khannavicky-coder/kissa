import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const childSchema = z.object({
  name: z.string().trim().min(1, "Add a name").max(60, "That's a bit long"),
  age: z.number().int().min(3, "Ages 3–9").max(9, "Ages 3–9"),
  avatar: z.string().min(1, "Pick an animal"),
});

const Stars = () => (
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

const Children = () => {
  const navigate = useNavigate();
  const [loadingList, setLoadingList] = useState(true);
  const [children, setChildren] = useState<Child[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(5);
  const [avatar, setAvatar] = useState<string>(ANIMALS[0].key);
  const [errors, setErrors] = useState<{ name?: string; age?: string; avatar?: string }>({});

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

  const resetForm = () => {
    setName("");
    setAge(5);
    setAvatar(ANIMALS[0].key);
    setErrors({});
    setShowForm(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = childSchema.safeParse({ name, age, avatar });
    if (!parsed.success) {
      const fe: typeof errors = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as keyof typeof errors;
        fe[k] = i.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setSubmitting(false);
      navigate("/", { replace: true });
      return;
    }
    const { data, error } = await supabase
      .from("children")
      .insert({ parent_user_id: userId, name: parsed.data.name, age: parsed.data.age, avatar: parsed.data.avatar })
      .select("id, name, age, avatar")
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message.includes("only have up to 2") ? "You've reached the 2 profile limit." : error.message);
      return;
    }
    setChildren((c) => [...c, data as Child]);
    toast.success(`${data!.name} joined Kissa! ✨`);
    resetForm();
  };

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
        </header>

        <section className="mt-6 text-center animate-fade-up" style={{ animationDelay: "0.05s" }}>
          <h1 className="font-display text-4xl font-black leading-[1.05] text-gold sm:text-5xl">
            Who's coming<br />on the journey?
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm text-cream/75">
            Add up to two little dreamers. Each one picks their own cuddly companion.
          </p>
        </section>

        {/* Slots */}
        <div className="mt-8 grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          {slots.map((idx) => {
            const child = children[idx];
            if (child) {
              const animal = ANIMALS.find((a) => a.key === child.avatar) ?? ANIMALS[0];
              return (
                <article
                  key={child.id}
                  className="relative flex flex-col items-center gap-2 rounded-3xl bg-card/70 p-4 shadow-soft backdrop-blur-sm border border-border"
                >
                  <button
                    onClick={() => handleDelete(child.id, child.name)}
                    aria-label={`Remove ${child.name}`}
                    className="absolute right-2 top-2 rounded-full p-1.5 text-cream/60 hover:bg-destructive/20 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-gold text-5xl shadow-gold animate-float-slow">
                    {animal.emoji}
                  </div>
                  <p className="font-display text-lg font-bold text-cream">{child.name}</p>
                  <p className="text-xs uppercase tracking-widest text-gold-soft">{child.age} years</p>
                </article>
              );
            }
            return (
              <button
                key={`empty-${idx}`}
                onClick={() => canAdd && setShowForm(true)}
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

        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleAdd}
            className="mt-6 space-y-4 rounded-3xl bg-card/70 p-5 shadow-soft backdrop-blur-sm border border-border animate-fade-up"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-display text-2xl font-bold text-gold">New little dreamer</h2>
              <button
                type="button"
                onClick={resetForm}
                aria-label="Close"
                className="rounded-full p-1.5 text-cream/60 hover:bg-secondary hover:text-cream transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="child-name" className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
                Name
              </Label>
              <Input
                id="child-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Little one"
                maxLength={60}
                className="h-12 rounded-xl border-2 border-border bg-input/60 px-4 text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              {errors.name && <p className="text-xs font-medium text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
                Age <span className="ml-1 text-cream/60 normal-case tracking-normal">({age})</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {[3, 4, 5, 6, 7, 8, 9].map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAge(a)}
                    className={cn(
                      "h-11 w-11 rounded-2xl text-base font-bold transition-all",
                      age === a
                        ? "bg-gradient-gold text-primary-foreground shadow-gold scale-105"
                        : "bg-secondary text-cream/80 hover:bg-secondary/70",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {errors.age && <p className="text-xs font-medium text-destructive">{errors.age}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
                Pick a friend
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {ANIMALS.map((a) => {
                  const selected = avatar === a.key;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setAvatar(a.key)}
                      aria-label={a.label}
                      className={cn(
                        "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl text-3xl transition-all",
                        selected
                          ? "bg-gradient-gold shadow-gold scale-105 ring-2 ring-gold"
                          : "bg-secondary hover:bg-secondary/70",
                      )}
                    >
                      <span>{a.emoji}</span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider",
                          selected ? "text-primary-foreground" : "text-cream/60",
                        )}
                      >
                        {a.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.avatar && <p className="text-xs font-medium text-destructive">{errors.avatar}</p>}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="h-14 w-full rounded-2xl bg-gradient-gold text-base font-bold text-primary-foreground shadow-gold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save profile"}
            </Button>
          </form>
        )}

        {!showForm && children.length > 0 && canAdd && (
          <Button
            onClick={() => setShowForm(true)}
            variant="outline"
            className="mt-6 h-12 w-full rounded-2xl border-2 border-border bg-secondary/60 text-sm font-semibold text-cream hover:bg-secondary"
          >
            <Plus className="mr-2 h-4 w-4" /> Add another
          </Button>
        )}

        {!canAdd && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Two profiles is plenty — Kissa likes a cozy crowd.
          </p>
        )}
      </div>
    </main>
  );
};

export default Children;
