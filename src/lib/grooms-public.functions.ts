import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PUBLIC_FIELDS =
  "id, full_name, phone, national_id, family_branch, photo_url, national_id_url, request_type, request_details, status, edit_token, created_at";

function normalizePhone(input: string): string {
  return input.replace(/[^\d]/g, "").replace(/^0+/, "");
}

// Look up a groom by edit_token (used in /groom-edit/$token)
export const lookupGroomByToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) =>
    z.object({ token: z.string().min(10).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("grooms")
      .select(PUBLIC_FIELDS)
      .eq("edit_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { groom: row ?? null };
  });

// Look up the latest groom record for a phone number (used in /groom-edit search)
export const lookupGroomByPhone = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) =>
    z.object({ phone: z.string().min(7).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const phone = normalizePhone(data.phone);
    if (phone.length < 7) return { groom: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("grooms")
      .select(PUBLIC_FIELDS)
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { groom: row ?? null };
  });

// Apply public-facing updates to a groom record, gated by edit_token
export const updateGroomByToken = createServerFn({ method: "POST" })
  .inputValidator((input: {
    token: string;
    updates: {
      photo_url?: string;
      national_id_url?: string;
      request_type?: string;
      request_details?: string | null;
    };
  }) =>
    z
      .object({
        token: z.string().min(10).max(200),
        updates: z
          .object({
            photo_url: z.string().url().max(1024).optional(),
            national_id_url: z.string().url().max(1024).optional(),
            request_type: z.string().max(60).optional(),
            request_details: z.string().max(2000).nullable().optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (Object.keys(data.updates).length === 0) return { ok: true as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("grooms")
      .update(data.updates)
      .eq("edit_token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// Public groom registration (anon) — handles duplicate check and insert server-side
const RegisterSchema = z.object({
  full_name: z.string().min(2).max(200),
  phone: z.string().min(7).max(20),
  national_id: z.string().min(4).max(30),
  family_branch: z.string().min(1).max(120).default("غير محدد"),
  national_id_url: z.string().url().max(1024).nullable().optional(),
  photo_url: z.string().url().max(1024).nullable().optional(),
  extra_sheep: z.number().int().min(0).max(100).default(0),
  extra_cards_men: z.number().int().min(0).max(1000).default(0),
  extra_cards_women: z.number().int().min(0).max(1000).default(0),
  external_participation: z.boolean().default(false),
  external_participation_details: z.string().max(2000).nullable().optional(),
  vip_guests: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const registerGroomPublic = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof RegisterSchema>) => RegisterSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const phone = data.phone.trim();
    const nid = data.national_id.trim();
    const { data: dup, error: dupErr } = await supabaseAdmin
      .from("grooms")
      .select("id, phone, national_id")
      .or(`phone.eq.${phone},national_id.eq.${nid}`)
      .limit(1);
    if (dupErr) throw new Error(dupErr.message);
    if (dup && dup.length > 0) {
      const which = dup[0].phone === phone ? "phone" : "national_id";
      return { duplicate: which as "phone" | "national_id" };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("grooms")
      .insert({
        full_name: data.full_name.trim(),
        phone,
        national_id: nid,
        family_branch: data.family_branch,
        national_id_url: data.national_id_url ?? null,
        photo_url: data.photo_url ?? null,
        extra_sheep: data.extra_sheep,
        extra_cards_men: data.extra_cards_men,
        extra_cards_women: data.extra_cards_women,
        external_participation: data.external_participation,
        external_participation_details: data.external_participation_details ?? null,
        vip_guests: data.vip_guests ?? null,
        notes: data.notes ?? null,
        status: "new",
        created_by: null,
      })
      .select("id, edit_token")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id as string, edit_token: inserted.edit_token as string };
  });