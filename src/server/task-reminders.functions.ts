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

const PRIORITY_RANK: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

/**
 * Send in-app reminders to the assignee and committee head for the
 * top-priority pending task in each committee.
 */
export const sendFirstTaskReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { committee_ids?: string[] }) => input ?? {})
  .handler(async ({ data, context }) => {
    await ensureAdminOrQuality(context.supabase, context.userId);

    let q = supabaseAdmin
      .from("committee_tasks")
      .select("id, title, committee_id, assigned_to, status, priority, sort_order, created_at, due_date")
      .neq("status", "done")
      .neq("status", "cancelled");
    if (data.committee_ids?.length) q = q.in("committee_id", data.committee_ids);
    const { data: tasks, error } = await q;
    if (error) throw new Error(error.message);

    // pick the topmost task per committee: by priority rank, then sort_order asc, then created_at desc
    const byCommittee = new Map<string, any>();
    for (const t of tasks ?? []) {
      const cur = byCommittee.get(t.committee_id);
      if (!cur) { byCommittee.set(t.committee_id, t); continue; }
      const a = PRIORITY_RANK[t.priority] ?? 9;
      const b = PRIORITY_RANK[cur.priority] ?? 9;
      if (a < b) byCommittee.set(t.committee_id, t);
      else if (a === b) {
        if ((t.sort_order ?? 0) < (cur.sort_order ?? 0)) byCommittee.set(t.committee_id, t);
        else if ((t.sort_order ?? 0) === (cur.sort_order ?? 0)
          && new Date(t.created_at).getTime() > new Date(cur.created_at).getTime()) {
          byCommittee.set(t.committee_id, t);
        }
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