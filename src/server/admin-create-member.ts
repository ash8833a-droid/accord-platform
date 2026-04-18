import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Role = "admin" | "committee" | "delegate" | "quality";

interface Input {
  full_name: string;
  phone: string;
  password: string;
  family_branch?: string | null;
  role: Role;
  committee_id?: string | null;
}

const phoneToEmail = (raw: string) => `${raw.replace(/\D/g, "")}@phone.local`;

export const adminCreateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    if (!input.full_name?.trim() || !input.phone?.trim() || !input.password) {
      throw new Error("البيانات ناقصة");
    }
    if (input.password.length < 6) {
      throw new Error("كلمة المرور قصيرة");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is admin (RLS as the caller)
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("صلاحيات غير كافية");

    const email = phoneToEmail(data.phone);
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        family_branch: data.family_branch ?? null,
      },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message || "تعذّر إنشاء الحساب";
      throw new Error(/already|exists|registered/i.test(msg) ? "رقم الجوال مسجّل مسبقاً" : msg);
    }

    const newUserId = created.user.id;

    await supabaseAdmin.from("profiles").upsert(
      {
        user_id: newUserId,
        full_name: data.full_name,
        phone: data.phone,
        family_branch: data.family_branch ?? null,
      },
      { onConflict: "user_id" },
    );

    const { error: insertRoleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: data.role,
      committee_id: data.committee_id ?? null,
    });
    if (insertRoleErr) throw new Error(insertRoleErr.message);

    await supabaseAdmin.from("membership_requests").insert({
      user_id: newUserId,
      full_name: data.full_name,
      phone: data.phone,
      family_branch: data.family_branch ?? null,
      assigned_role: data.role,
      assigned_committee_id: data.committee_id ?? null,
      status: "approved",
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: "تم إنشاؤه يدوياً من قبل المدير",
    });

    return { ok: true as const, user_id: newUserId };
  });
