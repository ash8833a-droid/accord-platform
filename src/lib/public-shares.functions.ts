import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ContributorSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  amount: z.number().int().min(1).max(1_000_000),
  notes: z.string().trim().max(300).optional().nullable(),
});

const SubmissionSchema = z.object({
  hijri_year: z.number().int().min(1300).max(1600),
  delegate_name: z.string().trim().min(2).max(120),
  family_branch: z.string().trim().min(2).max(80),
  contributors: z.array(ContributorSchema).min(1).max(200),
});

export type PublicSharesSubmission = z.infer<typeof SubmissionSchema>;

export const submitFamilyShares = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SubmissionSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const delegateLabel = `المندوب: ${data.delegate_name}`;
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