import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  user_agent: string | null;
  occurred_at_local: string | null;
  created_at: string;
};

type Profile = {
  user_id: string;
  parent_name: string | null;
  child_name: string | null;
  created_at: string;
};

type Child = {
  id: string;
  parent_user_id: string;
  name: string;
  age: number;
  avatar: string;
  created_at: string;
};

type Story = {
  id: string;
  parent_user_id: string;
  child_id: string;
  title: string | null;
  status: string;
  played_count: number;
  last_played_at: string | null;
  created_at: string;
};

type VoiceProfile = {
  id: string;
  parent_user_id: string;
  status: string;
  error_message: string | null;
  elevenlabs_voice_id: string | null;
  updated_at: string;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 19) : "—";

const Pill = ({ status }: { status: string }) => {
  const cls =
    status === "success" || status === "ready"
      ? "bg-emerald-500/20 text-emerald-300"
      : status === "pending"
      ? "bg-amber-500/20 text-amber-300"
      : "bg-destructive/20 text-destructive";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] ${cls}`}>{status}</span>;
};

export default function AdminLogs() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [voices, setVoices] = useState<VoiceProfile[]>([]);

  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      const admin = !!roleRow;
      setIsAdmin(admin);
      if (!admin) {
        setLoading(false);
        return;
      }

      const [logsRes, profilesRes, childrenRes, storiesRes, voicesRes] = await Promise.all([
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("user_id, parent_name, child_name, created_at").order("created_at", { ascending: false }),
        supabase.from("children").select("*").order("created_at", { ascending: false }),
        supabase.from("stories").select("id, parent_user_id, child_id, title, status, played_count, last_played_at, created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("voice_profiles").select("id, parent_user_id, status, error_message, elevenlabs_voice_id, updated_at").order("updated_at", { ascending: false }),
      ]);

      setLogs((logsRes.data as AuditLog[]) ?? []);
      setProfiles((profilesRes.data as Profile[]) ?? []);
      setChildren((childrenRes.data as Child[]) ?? []);
      setStories((storiesRes.data as Story[]) ?? []);
      setVoices((voicesRes.data as VoiceProfile[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  // Build user roll-up (children counts + last activity)
  const userRows = useMemo(() => {
    const childCount = new Map<string, number>();
    children.forEach((c) => childCount.set(c.parent_user_id, (childCount.get(c.parent_user_id) ?? 0) + 1));
    const lastSeen = new Map<string, string>();
    logs.forEach((l) => {
      if (!l.user_id) return;
      const prev = lastSeen.get(l.user_id);
      if (!prev || l.created_at > prev) lastSeen.set(l.user_id, l.created_at);
    });
    return profiles.map((p) => ({
      ...p,
      child_count: childCount.get(p.user_id) ?? 0,
      last_activity: lastSeen.get(p.user_id) ?? null,
    }));
  }, [profiles, children, logs]);

  const filteredLogs = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.status.toLowerCase().includes(q) ||
        (l.country ?? "").toLowerCase().includes(q) ||
        (l.user_id ?? "").toLowerCase().includes(q),
    );
  }, [logs, filter]);

  const childName = (id: string) => children.find((c) => c.id === id)?.name ?? "—";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:text-gold-soft"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-display text-2xl font-bold text-gold">Admin panel</h1>
          <span className="w-12" />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        ) : !isAdmin ? (
          <div className="rounded-2xl border border-border bg-card/60 p-8 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <p className="text-cream/80">You need the admin role to view this panel.</p>
          </div>
        ) : (
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="users">Users ({userRows.length})</TabsTrigger>
              <TabsTrigger value="stories">Stories ({stories.length})</TabsTrigger>
              <TabsTrigger value="voices">Voices ({voices.length})</TabsTrigger>
              <TabsTrigger value="logs">Audit logs</TabsTrigger>
            </TabsList>

            {/* USERS */}
            <TabsContent value="users" className="mt-4">
              <div className="overflow-x-auto rounded-2xl border border-border bg-card/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-cream/70">
                    <tr>
                      <th className="px-3 py-2">Parent</th>
                      <th className="px-3 py-2">User ID</th>
                      <th className="px-3 py-2">Children</th>
                      <th className="px-3 py-2">Signed up</th>
                      <th className="px-3 py-2">Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRows.map((u) => {
                      const kids = children.filter((c) => c.parent_user_id === u.user_id);
                      return (
                        <tr key={u.user_id} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2 font-semibold text-cream">{u.parent_name ?? "—"}</td>
                          <td className="px-3 py-2 font-mono text-[10px] text-cream/60">{u.user_id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-cream/80">
                            {u.child_count}
                            {kids.length > 0 && (
                              <div className="text-[10px] text-cream/50">
                                {kids.map((k) => `${k.avatar} ${k.name} (${k.age})`).join(", ")}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-cream/70">{fmt(u.created_at)}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-cream/70">{fmt(u.last_activity)}</td>
                        </tr>
                      );
                    })}
                    {userRows.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-cream/50">No users yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* STORIES */}
            <TabsContent value="stories" className="mt-4">
              <div className="overflow-x-auto rounded-2xl border border-border bg-card/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-cream/70">
                    <tr>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Child</th>
                      <th className="px-3 py-2">Parent</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Plays</th>
                      <th className="px-3 py-2">Last played</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stories.map((s) => (
                      <tr key={s.id} className="border-t border-border/60 align-top">
                        <td className="px-3 py-2 font-semibold text-cream">{s.title ?? "Untitled"}</td>
                        <td className="px-3 py-2 text-cream/70">{childName(s.child_id)}</td>
                        <td className="px-3 py-2 font-mono text-[10px] text-cream/60">{s.parent_user_id.slice(0, 8)}</td>
                        <td className="px-3 py-2"><Pill status={s.status} /></td>
                        <td className="px-3 py-2 text-cream/80">{s.played_count}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-cream/70">{fmt(s.last_played_at)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-cream/70">{fmt(s.created_at)}</td>
                      </tr>
                    ))}
                    {stories.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-cream/50">No stories yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* VOICES */}
            <TabsContent value="voices" className="mt-4">
              <div className="overflow-x-auto rounded-2xl border border-border bg-card/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-cream/70">
                    <tr>
                      <th className="px-3 py-2">Parent</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">ElevenLabs voice</th>
                      <th className="px-3 py-2">Error</th>
                      <th className="px-3 py-2">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voices.map((v) => (
                      <tr key={v.id} className="border-t border-border/60 align-top">
                        <td className="px-3 py-2 font-mono text-[10px] text-cream/60">{v.parent_user_id.slice(0, 8)}</td>
                        <td className="px-3 py-2"><Pill status={v.status} /></td>
                        <td className="px-3 py-2 font-mono text-[10px] text-cream/70">{v.elevenlabs_voice_id ?? "—"}</td>
                        <td className="px-3 py-2 text-destructive/80">{v.error_message ?? ""}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-cream/70">{fmt(v.updated_at)}</td>
                      </tr>
                    ))}
                    {voices.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-8 text-center text-cream/50">No voice profiles yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* LOGS */}
            <TabsContent value="logs" className="mt-4">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by action, status, country, user id…"
                className="mb-4 h-11 w-full rounded-xl border-2 border-border bg-input/60 px-4 text-sm text-foreground"
              />
              <div className="overflow-x-auto rounded-2xl border border-border bg-card/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-cream/70">
                    <tr>
                      <th className="px-3 py-2">When (UTC)</th>
                      <th className="px-3 py-2">Local</th>
                      <th className="px-3 py-2">User</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Entity</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">IP</th>
                      <th className="px-3 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l) => (
                      <tr key={l.id} className="border-t border-border/60 align-top">
                        <td className="whitespace-nowrap px-3 py-2 text-cream/70">{fmt(l.created_at)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-cream/70">
                          {l.occurred_at_local ? new Date(l.occurred_at_local).toLocaleString() : "—"}
                          <div className="text-[10px] text-cream/40">{l.timezone ?? ""}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-cream/60">{l.user_id?.slice(0, 8) ?? "—"}</td>
                        <td className="px-3 py-2 font-semibold text-gold-soft">{l.action}</td>
                        <td className="px-3 py-2"><Pill status={l.status} /></td>
                        <td className="px-3 py-2 text-cream/70">
                          {l.entity_type ?? "—"}
                          {l.entity_id && (
                            <div className="font-mono text-[10px] text-cream/40">{l.entity_id.slice(0, 8)}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-cream/70">
                          {[l.city, l.region, l.country].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-cream/50">{l.ip_address ?? "—"}</td>
                        <td className="px-3 py-2 text-destructive/80">{l.error_message ?? ""}</td>
                      </tr>
                    ))}
                    {filteredLogs.length === 0 && (
                      <tr><td colSpan={9} className="px-3 py-8 text-center text-cream/50">No logs match.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-cream/50">
                Showing latest {filteredLogs.length} of up to 500 entries. Logs auto-purge after 90 days.
              </p>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
