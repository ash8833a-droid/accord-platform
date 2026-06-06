import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdminOrQuality(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: isQuality }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "quality" }),
  ]);
  if (!isAdmin && !isQuality) throw new Error("صلاحيات غير كافية");
}

/**
 * Send in-app reminders to the assignee and committee head for the
 * oldest pending task (FIFO) in each committee.
 */
export const sendFirstTaskReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { committee_ids?: string[] }) => input ?? {})
  .handler(async ({ data, context }) => {
    await ensureAdminOrQuality(context.supabase, context.userId);

    let q = supabaseAdmin
      .from("committee_tasks")
      .select("id, title, committee_id, assigned_to, status, sort_order, created_at, due_date")
      .neq("status", "completed");
    if (data.committee_ids?.length) q = q.in("committee_id", data.committee_ids);
    const { data: tasks, error } = await q;
    if (error) throw new Error(error.message);

    // FIFO: pick the oldest pending task per committee.
    const byCommittee = new Map<string, any>();
    for (const t of (tasks ?? []) as any[]) {
      const cur = byCommittee.get(t.committee_id);
      if (!cur || new Date(t.created_at).getTime() < new Date(cur.created_at).getTime()) {
        byCommittee.set(t.committee_id, t);
      }
    }

    const firstTasks = Array.from(byCommittee.values());
    if (firstTasks.length === 0) return { sent: 0, committees: 0 };

    const committeeIds = firstTasks.map((t) => t.committee_id);
    const { data: committees } = await supabaseAdmin
      .from("committees")
      .select("id, name, head_user_id")
      .in("id", committeeIds);
    const committeeMap = new Map((committees ?? []).map((c: any) => [c.id, c]));

    const notifications: any[] = [];
    for (const t of firstTasks) {
      const c = committeeMap.get(t.committee_id);
      const recipients = new Set<string>();
      if (t.assigned_to) recipients.add(t.assigned_to);
      if (c?.head_user_id) recipients.add(c.head_user_id);
      if (recipients.size === 0) continue;
      const dueText = t.due_date ? ` — مستحقة بتاريخ ${t.due_date}` : "";
      const body = `تذكير: المهمة الأولى للجنة (${c?.name ?? ""}): «${t.title}»${dueText}. يرجى متابعة الاستكمال.`;
      for (const uid of recipients) {
        notifications.push({
          user_id: uid,
          type: "task_reminder",
          title: "تذكير بالمهمة العاجلة",
          body,
          link: "/admin/tasks",
          related_id: t.id,
        });
      }
    }

    if (notifications.length === 0) return { sent: 0, committees: firstTasks.length };

    const { error: insErr } = await supabaseAdmin.from("notifications").insert(notifications);
    if (insErr) throw new Error(insErr.message);

    return { sent: notifications.length, committees: firstTasks.length };
  });