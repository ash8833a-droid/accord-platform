import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Body = {
  phone: string;
  password: string;
  full_name: string;
  family_branch?: string | null;
  role: "admin" | "committee" | "delegate" | "quality";
  committee_id?: string | null;
};

const phoneToEmail = (raw: string) => `${raw.replace(/\D/g, "")}@phone.local`;

export const Route = createFileRoute("/api/admin/create-member")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const SUPABASE_URL =
            (process.env.SUPABASE_URL as string) ||
            (process.env.VITE_SUPABASE_URL as string);
          const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
          const ANON_KEY =
            (process.env.SUPABASE_PUBLISHABLE_KEY as string) ||
            (process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
          if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
            return Response.json(
              {
                error: `إعدادات الخادم غير مكتملة (URL:${!!SUPABASE_URL}, SERVICE:${!!SERVICE_KEY}, ANON:${!!ANON_KEY})`,
              },
              { status: 500 },
            );
          }

          // Verify caller is admin
          const authHeader = request.headers.get("Authorization") || "";
          const token = authHeader.replace(/^Bearer\s+/i, "");
          if (!token) {
            return Response.json({ error: "غير مصرح" }, { status: 401 });
          }
          const userClient = createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data: userData, error: userErr } = await userClient.auth.getUser();
          if (userErr || !userData.user) {
            return Response.json({ error: "غير مصرح" }, { status: 401 });
          }
          const callerId = userData.user.id;
          const { data: isAdmin } = await userClient.rpc("has_role", {
            _user_id: callerId,
            _role: "admin",
          });
          if (!isAdmin) {
            return Response.json({ error: "صلاحيات غير كافية" }, { status: 403 });
          }

          const body = (await request.json()) as Body;
          if (!body.phone || !body.password || !body.full_name || !body.role) {
            return Response.json({ error: "البيانات ناقصة" }, { status: 400 });
          }

          const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const email = phoneToEmail(body.phone);
          const { data: created, error: createErr } = await admin.auth.admin.createUser({
            email,
            password: body.password,
            email_confirm: true,
            user_metadata: {
              full_name: body.full_name,
              phone: body.phone,
              family_branch: body.family_branch ?? null,
            },
          });
          if (createErr || !created.user) {
            const msg = createErr?.message || "تعذّر إنشاء الحساب";
            const friendly = /already|exists|registered/i.test(msg)
              ? "رقم الجوال مسجّل مسبقاً"
              : msg;
            return Response.json({ error: friendly }, { status: 400 });
          }

          const newUserId = created.user.id;

          // Ensure profile exists / is up-to-date (trigger usually creates it)
          await admin.from("profiles").upsert(
            {
              user_id: newUserId,
              full_name: body.full_name,
              phone: body.phone,
              family_branch: body.family_branch ?? null,
            },
            { onConflict: "user_id" },
          );

          // Assign role
          const { error: roleErr } = await admin.from("user_roles").insert({
            user_id: newUserId,
            role: body.role,
            committee_id: body.committee_id ?? null,
          });
          if (roleErr) {
            return Response.json({ error: roleErr.message }, { status: 400 });
          }

          // Create approved membership_request record for traceability
          await admin.from("membership_requests").insert({
            user_id: newUserId,
            full_name: body.full_name,
            phone: body.phone,
            family_branch: body.family_branch ?? null,
            assigned_role: body.role,
            assigned_committee_id: body.committee_id ?? null,
            status: "approved",
            reviewed_by: callerId,
            reviewed_at: new Date().toISOString(),
            review_notes: "تم إنشاؤه يدوياً من قبل المدير",
          });

          return Response.json({ ok: true, user_id: newUserId });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "خطأ غير متوقع";
          return Response.json({ error: msg }, { status: 500 });
        }
      },
    },
  },
});
