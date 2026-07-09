import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ContributorSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  amount: z.number().int().min(1).max(50_000),
  notes: z.string().trim().max(300).optional().nullable(),
});

const SubmissionSchema = z.object({
  hijri_year: z.number().int().min(1300).max(1600),
  delegate_name: z.string().trim().min(2).max(120),
  family_branch: z.string().trim().min(2).max(80),
  contributors: z.array(ContributorSchema).min(1).max(50),
});

export type PublicSharesSubmission = z.infer<typeof SubmissionSchema>;

export const submitFamilyShares = createServerFn({ method: "POST" })
  // Require an authenticated session so submissions are attributable and
  // subject to RLS on historical_shareholders (finance/admin only).
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmissionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Enforce a server-side cap on inserts per request (defence-in-depth on
    // top of the schema's 50-row Zod limit).
    if (data.contributors.length > 50) {
      throw new Error("لا يمكن حفظ أكثر من 50 مساهماً في طلب واحد");
    }
    // Unauthenticated public submissions are flagged so finance staff can
    // review them before treating the entry as verified.
    const UNVERIFIED_TAG = "[غير مُتحقَّق]";
    const delegateLabel = `${UNVERIFIED_TAG} ممثل الأسرة: ${data.delegate_name} · مُقدِّم: ${context.userId}`;
    const rows = data.contributors.map((c) => ({
      full_name: c.full_name.trim(),
      family_branch: data.family_branch.trim(),
      hijri_year: data.hijri_year,
      amount: c.amount,
      notes: c.notes && c.notes.trim().length > 0
        ? `${delegateLabel} — ${c.notes.trim()}`
        : delegateLabel,
    }));
    const { error, count } = await supabaseAdmin
      .from("historical_shareholders")
      .insert(rows, { count: "exact" });
    if (error) {
      throw new Error(`تعذّر حفظ المساهمات: ${error.message}`);
    }
    return { inserted: count ?? rows.length };
  });