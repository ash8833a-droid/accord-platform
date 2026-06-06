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