// One-shot bootstrap: create / promote رئيس لجنة الزواج الجماعي to full admin.
// Uses service role; safe to call multiple times (idempotent).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const phone = "0555541143";
  const email = `${phone}@phone.local`;
  const password = "123456";
  const fullName = "رئيس لجنة الزواج الجماعي";

  try {
    // 1) Find existing user by email
    let userId: string | null = null;
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (list.error) throw list.error;
    const existing = list.data.users.find((u) => u.email?.toLowerCase() === email);
    if (existing) {
      userId = existing.id;
      // Reset password + ensure confirmed
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });
    } else {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      });
      if (created.error || !created.data.user) throw created.error ?? new Error("create failed");
      userId = created.data.user.id;
    }

    // 2) Upsert profile
    await admin.from("profiles").upsert(
      { user_id: userId, full_name: fullName, phone },
      { onConflict: "user_id" },
    );

    // 3) Ensure admin role (clear any non-admin rows then insert admin if missing)
    const { data: roles } = await admin.from("user_roles").select("id, role").eq("user_id", userId);
    const hasAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!hasAdmin) {
      await admin.from("user_roles").insert({ user_id: userId, role: "admin", committee_id: null });
    }

    // 4) Approved membership record (so any UI gating treats them as approved)
    const { data: mr } = await admin
      .from("membership_requests").select("id").eq("user_id", userId).limit(1);
    if (!mr?.length) {
      await admin.from("membership_requests").insert({
        user_id: userId,
        full_name: fullName,
        phone,
        assigned_role: "admin",
        status: "approved",
        reviewed_at: new Date().toISOString(),
        review_notes: "تم تعيينه رئيساً للجنة الزواج الجماعي بصلاحيات المشرف العام",
      });
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId, phone, role: "admin" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});