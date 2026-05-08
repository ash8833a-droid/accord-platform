import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public hook called by pg_cron periodically.
// Scans tasks due in the next 24h (and not completed) and inserts a
// `task_deadline` notification for every member of the task's committee,
// deduplicated against the same task within the last 20h.
export const Route = createFileRoute("/api/public/hooks/task-deadline-check")({
  server: {
    handlers: {
      POST: async () => {
        const nowIso = new Date().toISOString();
        const in24hIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { data: tasks, error } = await supabaseAdmin
          .from("committee_tasks")
          .select("id, title, committee_id, due_date, status")
          .neq("status", "completed")
          .not("due_date", "is", null)
          .gte("due_date", nowIso.slice(0, 10))
          .lte("due_date", in24hIso.slice(0, 10));

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!tasks || tasks.length === 0) {
          return new Response(JSON.stringify({ scanned: 0, inserted: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const sinceIso = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
        let inserted = 0;

        for (const t of tasks) {
          const { data: existing } = await supabaseAdmin
            .from("notifications")
            .select("id")
            .eq("type", "task_deadline")
            .eq("related_id", t.id)
            .gte("created_at", sinceIso)
            .limit(1);
          if (existing && existing.length > 0) continue;

          const { data: members } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("committee_id", t.committee_id);
          const ids = Array.from(new Set((members ?? []).map((m: any) => m.user_id).filter(Boolean)));
          if (ids.length === 0) continue;

          const rows = ids.map((uid) => ({
            user_id: uid,
            type: "task_deadline",
            title: "إجراء مطلوب: مهمة قاربت على الاستحقاق",
            body: `«${t.title}» مستحقة خلال أقل من 24 ساعة (${t.due_date}).`,
            link: "/admin/tasks",
            related_id: t.id,
          }));
          const { error: insErr } = await supabaseAdmin.from("notifications").insert(rows);
          if (!insErr) inserted += rows.length;
        }

        return new Response(
          JSON.stringify({ scanned: tasks.length, inserted }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});