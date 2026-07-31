import { createFileRoute } from "@tanstack/react-router";

/**
 * Weekly digest hook (called by pg_cron / external scheduler).
 * Sends ONE grouped notification per committee — instead of one per task —
 * to the committee head (falling back to all members) summarising overdue and
 * open tasks. Deduplicated per committee within 6 days.
 */
export const Route = createFileRoute("/api/public/hooks/weekly-committee-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const provided =
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          request.headers.get("x-cron-secret") ??
          "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const today = new Date().toISOString().slice(0, 10);
        const sinceIso = new Date(Date.now() - 6 * 86_400_000).toISOString();

        const [{ data: committees }, { data: tasks }] = await Promise.all([
          supabaseAdmin.from("committees").select("id, name"),
          supabaseAdmin
            .from("committee_tasks")
            .select("id, title, committee_id, due_date, status")
            .neq("status", "completed"),
        ]);

        let inserted = 0;
        let skipped = 0;

        for (const c of committees ?? []) {
          const open = (tasks ?? []).filter((t: any) => t.committee_id === c.id);
          const overdue = open.filter((t: any) => t.due_date && t.due_date < today);
          if (open.length === 0) continue;

          const { data: existing } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("type", "weekly_digest")
            .eq("related_id", c.id)
            .gte("created_at", sinceIso)
            .limit(1);
          if (existing && existing.length > 0) { skipped += 1; continue; }

          const { data: roles } = await supabaseAdmin
            .from("user_roles")
            .select("user_id, role")
            .eq("committee_id", c.id);
          const heads = (roles ?? []).filter((r: any) => r.role === "committee_head").map((r: any) => r.user_id);
          const targets = Array.from(
            new Set((heads.length > 0 ? heads : (roles ?? []).map((r: any) => r.user_id)).filter(Boolean)),
          );
          if (targets.length === 0) continue;

          const sample = overdue.slice(0, 3).map((t: any) => `• ${t.title}`).join("\n");
          const rows = targets.map((uid) => ({
            user_id: uid,
            type: "weekly_digest",
            title: `ملخّص أسبوعي — ${c.name}`,
            body:
              `لديكم ${open.length} مهمة مفتوحة` +
              (overdue.length > 0 ? `، منها ${overdue.length} متأخرة:\n${sample}` : "، ولا توجد مهام متأخرة.") ,
            link: "/admin/tasks",
            related_id: c.id,
          }));
          const { error } = await supabaseAdmin.from("notifications").insert(rows);
          if (!error) inserted += rows.length;
        }

        return new Response(JSON.stringify({ committees: (committees ?? []).length, inserted, skipped }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
