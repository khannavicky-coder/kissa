import { useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import type { Child } from "@/lib/supabaseService";

export type AddedChild = Child;

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (child: AddedChild) => void;
};

export const AddChildDialog = ({ open, onOpenChange, onAdded }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(5);
  const [avatar, setAvatar] = useState<string>(ANIMALS[0].key);
  const [errors, setErrors] = useState<{ name?: string; age?: string; avatar?: string }>({});

  const reset = () => {
    setName("");
    setAge(5);
    setAvatar(ANIMALS[0].key);
    setErrors({});
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
      toast.error("Please sign in again.");
      return;
    }
    const { data, error } = await supabase
      .from("children")
      .insert({ parent_user_id: userId, name: parsed.data.name, age: parsed.data.age, avatar: parsed.data.avatar })
      .select("*")
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message.includes("only have up to 2") ? "You've reached the 2 profile limit." : error.message);
      return;
    }
    toast.success(`${data!.name} joined Kissa! ✨`);
    onAdded(data as AddedChild);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md rounded-3xl bg-card/95 border-border backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-bold text-gold">New little dreamer</DialogTitle>
          <DialogDescription className="text-cream/70">
            Add a child profile to personalise every story.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="child-name-dialog" className="text-xs font-semibold uppercase tracking-wider text-gold-soft">
              Name
            </Label>
            <Input
              id="child-name-dialog"
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
      </DialogContent>
    </Dialog>
  );
};
