import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";

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

export default function AdminLogs() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
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
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setLogs((data as AuditLog[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const filtered = logs.filter((l) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q) ||
      (l.country ?? "").toLowerCase().includes(q) ||
      (l.user_id ?? "").toLowerCase().includes(q)
    );
  });

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
          <h1 className="font-display text-2xl font-bold text-gold">Audit logs</h1>
          <span className="w-12" />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        ) : !isAdmin ? (
          <div className="rounded-2xl border border-border bg-card/60 p-8 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <p className="text-cream/80">You need the admin role to view logs.</p>
          </div>
        ) : (
          <>
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
                  {filtered.map((l) => (
                    <tr key={l.id} className="border-t border-border/60 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-cream/70">
                        {new Date(l.created_at).toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-cream/70">
                        {l.occurred_at_local
                          ? new Date(l.occurred_at_local).toLocaleString()
                          : "—"}
                        <div className="text-[10px] text-cream/40">{l.timezone ?? ""}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-cream/60">
                        {l.user_id?.slice(0, 8) ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gold-soft">{l.action}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            l.status === "success"
                              ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300"
                              : "rounded-full bg-destructive/20 px-2 py-0.5 text-destructive"
                          }
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-cream/70">
                        {l.entity_type ?? "—"}
                        {l.entity_id && (
                          <div className="font-mono text-[10px] text-cream/40">
                            {l.entity_id.slice(0, 8)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-cream/70">
                        {[l.city, l.region, l.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-cream/50">
                        {l.ip_address ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-destructive/80">
                        {l.error_message ?? ""}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-cream/50">
                        No logs match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-cream/50">
              Showing latest {filtered.length} of up to 500 entries. Logs auto-purge after 90 days.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
