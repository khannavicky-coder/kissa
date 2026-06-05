import { supabase } from "@/integrations/supabase/client";

export type AuditStatus = "success" | "failure";

export interface LogEventInput {
  action: string;
  entity_type?: string | null;
  entity_id?: string | number | null;
  status?: AuditStatus;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget client-side audit logger.
 * Captures local timezone + local timestamp; the edge function adds IP/geo.
 */
export function logEvent(input: LogEventInput): void {
  const payload = {
    ...input,
    status: input.status ?? "success",
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    occurred_at_local: new Date().toISOString(),
  };

  // Don't await — never block the UI on logging.
  supabase.functions
    .invoke("log-event", { body: payload })
    .catch((err) => {
      // Last-resort console signal; never throw.
      console.warn("[audit] log failed", err);
    });
}
