import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("صلاحيات غير كافية");
}

// ===== Delete user permanently =====
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => {
    if (!input?.user_id) throw new Error("user_id مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) throw new Error("لا يمكنك حذف حسابك");
    // Cleanup related rows that reference user
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("page_permissions").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_account_status").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ===== Reset password =====
export const adminResetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; new_password: string }) => {
    if (!input?.user_id) throw new Error("user_id مطلوب");
    if (!input?.new_password || input.new_password.length < 6)
      throw new Error("كلمة المرور قصيرة (6 أحرف على الأقل)");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ===== Toggle disable / enable =====
export const adminToggleAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; disabled: boolean; reason?: string }) => {
    if (!input?.user_id) throw new Error("user_id مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && data.disabled)
      throw new Error("لا يمكنك تعطيل حسابك");
    // ban_duration: '876000h' (~100 years) for disable; 'none' to unban
    const { error: banErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (banErr) throw new Error(banErr.message);
    await supabaseAdmin.from("user_account_status").upsert({
      user_id: data.user_id,
      is_disabled: data.disabled,
      disabled_reason: data.disabled ? data.reason ?? null : null,
      disabled_at: data.disabled ? new Date().toISOString() : null,
      disabled_by: data.disabled ? context.userId : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return { ok: true as const };
  });

// ===== Update role / committee =====
export const adminUpdateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; role: "admin"|"committee"|"committee_head"|"delegate"|"quality"; committee_id?: string | null }) => {
    if (!input?.user_id) throw new Error("user_id مطلوب");
    if (!input?.role) throw new Error("الدور مطلوب");
    return input;
  })
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    // Replace user roles with single new role assignment
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.user_id,
      role: data.role,
      committee_id: data.committee_id ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ===== List all users (admin view) =====
export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, phone, family_branch, created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, committee_id");
    const { data: statuses } = await supabaseAdmin
      .from("user_account_status")
      .select("user_id, is_disabled, disabled_reason, disabled_at");
    const rolesByUser: Record<string, { role: string; committee_id: string | null }[]> = {};
    (roles ?? []).forEach((r) => {
      (rolesByUser[r.user_id] ||= []).push({ role: r.role, committee_id: r.committee_id });
    });
    const statusByUser: Record<string, any> = {};
    (statuses ?? []).forEach((s) => { statusByUser[s.user_id] = s; });
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: rolesByUser[p.user_id] ?? [],
      status: statusByUser[p.user_id] ?? { is_disabled: false },
    }));
  });
