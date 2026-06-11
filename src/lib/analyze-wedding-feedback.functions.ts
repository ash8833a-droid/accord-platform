import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  // Optional year filter; otherwise analyze all data
  year: z.number().int().min(2000).max(2100).optional(),
});

export interface FeedbackAnalysis {
  executive_summary: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommendations: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  overall_satisfaction_label: string;
}

export const analyzeWeddingFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize: only admin or quality may run the analysis
    const [{ data: isAdmin }, { data: isQuality }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "quality" }),
    ]);
    if (!isAdmin && !isQuality) {
      throw new Error("غير مصرح بهذا الإجراء");
    }

    let query = supabase
      .from("wedding_feedback")
      .select("organization_score,hospitality_score,program_score,overall_score,suggestions,respondent_role,event_year,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.year) query = query.eq("event_year", data.year);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    if (list.length === 0) {
      throw new Error("لا توجد تقييمات كافية للتحليل بعد");
    }

    const avg = (k: keyof typeof list[number]) =>
      list.reduce((a, r) => a + (Number(r[k]) || 0), 0) / list.length;

    const stats = {
      count: list.length,
      organization: +avg("organization_score").toFixed(2),
      hospitality: +avg("hospitality_score").toFixed(2),
      program: +avg("program_score").toFixed(2),
      overall: +avg("overall_score").toFixed(2),
    };

    const suggestions = list
      .map((r) => r.suggestions)
      .filter((s): s is string => !!s && s.trim().length > 0)
      .slice(0, 200);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("خدمة التحليل غير مهيأة. تواصل مع الإدارة.");

    const systemPrompt = `أنت محلل خبير في تجارب الفعاليات والمناسبات الاجتماعية. ستحلل آراء ضيوف حفل زواج جماعي للعائلة بهدف التحسين والتطوير.

المعطيات: متوسطات تقييمات من 5 لأربعة محاور (التنظيم والاستقبال، الضيافة والعشاء، البرامج والفقرات، الانطباع العام)، وقائمة مقترحات نصية من الحضور.

المطلوب: تحليل عميق ومحايد باللغة العربية الفصحى، بصياغة احترافية وعملية، بصيغة JSON فقط.

الشكل المطلوب:
{
  "executive_summary": "ملخص تنفيذي 3-5 أسطر يشمل أبرز ما خرج به التقييم",
  "strengths": ["نقطة قوة مدعومة بالأرقام أو الآراء", "..."],
  "weaknesses": ["نقطة ضعف واضحة", "..."],
  "opportunities": ["فرصة تحسين قابلة للتنفيذ", "..."],
  "recommendations": ["توصية عملية محددة وقابلة للقياس", "..."],
  "sentiment": "positive | neutral | negative | mixed",
  "overall_satisfaction_label": "ممتاز / جيد جداً / جيد / مقبول / ضعيف"
}

قواعد:
- 3 إلى 6 عناصر لكل قائمة كحد أقصى.
- استند للأرقام والمقترحات الفعلية، لا تخترع.
- اجعل التوصيات قابلة للتنفيذ من اللجان (تنظيم، ضيافة، برامج، نسائية، استقبال).
- لا تتجاوز 400 حرف لكل عنصر.
- أعد JSON فقط بدون أي شرح إضافي.`;

    const userPayload = JSON.stringify({ stats, suggestions });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPayload },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) throw new Error("تجاوزت حد الطلبات. أعد المحاولة لاحقاً.");
      if (aiRes.status === 402) throw new Error("نفد رصيد التحليل الذكي. تواصل مع الإدارة.");
      throw new Error("فشل التحليل الذكي: " + t.slice(0, 200));
    }

    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<FeedbackAnalysis> = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = String(content).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const clean = (v: unknown) => String(v ?? "").trim().slice(0, 800);
    const arr = (v: unknown): string[] =>
      Array.isArray(v) ? v.map((x) => clean(x)).filter(Boolean).slice(0, 6) : [];
    const sentRaw = String(parsed.sentiment ?? "mixed").toLowerCase();
    const sentiment = (["positive", "neutral", "negative", "mixed"].includes(sentRaw)
      ? sentRaw
      : "mixed") as FeedbackAnalysis["sentiment"];

    const analysis: FeedbackAnalysis = {
      executive_summary: clean(parsed.executive_summary),
      strengths: arr(parsed.strengths),
      weaknesses: arr(parsed.weaknesses),
      opportunities: arr(parsed.opportunities),
      recommendations: arr(parsed.recommendations),
      sentiment,
      overall_satisfaction_label: clean(parsed.overall_satisfaction_label),
    };

    return { analysis, stats };
  });