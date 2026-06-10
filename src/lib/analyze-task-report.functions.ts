import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  fileBase64: z.string().min(10).max(20_000_000),
  mimeType: z.string().min(3).max(120),
  taskTitle: z.string().max(500).optional(),
});

interface ExtractedReport {
  action_taken: string;
  outcomes: string;
  completion_percent: number;
  challenges: string;
  recommendations: string;
  execution_date: string;
  attachments_note: string;
}

export const analyzeTaskReportFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("خدمة التحليل غير مهيأة حالياً. تواصل مع الإدارة.");
    }

    const systemPrompt = `أنت مساعد ذكي لاستخراج تقرير مهمة لجنة من مرفق (صورة / PDF / مستند).

المطلوب استخراج البيانات التالية من الملف باللغة العربية وبشكل مختصر ومنظم:
- action_taken: وصف الإجراء المتخذ فعلياً (إجباري، فقرة واضحة).
- outcomes: المخرجات والنتائج (اختياري).
- completion_percent: نسبة الإنجاز كرقم 0-100. إذا لم تُذكر صراحة استنتجها من السياق (مكتمل=100، قيد التنفيذ=50، لم يبدأ=0).
- challenges: التحديات أو المعوقات (اختياري).
- recommendations: التوصيات (اختياري).
- execution_date: تاريخ التنفيذ بصيغة YYYY-MM-DD (اختياري، اتركه فارغاً إن لم يوجد).
- attachments_note: ملاحظة قصيرة جداً عن المرفقات إن وُجدت.

قواعد:
- لا تخترع معلومات؛ اترك الحقل فارغاً إذا لم يكن واضحاً في الملف.
- لا تتجاوز 600 حرف لكل حقل نصي.
- أعد JSON فقط بدون أي شرح إضافي.

الشكل المطلوب:
{"action_taken":"...","outcomes":"...","completion_percent":0,"challenges":"...","recommendations":"...","execution_date":"","attachments_note":""}`;

    const contextLine = data.taskTitle
      ? `هذا الملف يخص المهمة: "${data.taskTitle}". استخرج تقرير الإنجاز منه.`
      : "استخرج تقرير الإنجاز من هذا الملف.";

    const userContent = data.mimeType.startsWith("image/")
      ? [
          { type: "text", text: contextLine },
          {
            type: "image_url",
            image_url: { url: `data:${data.mimeType};base64,${data.fileBase64}` },
          },
        ]
      : [
          { type: "text", text: contextLine },
          {
            type: "file",
            file: {
              filename: "document",
              file_data: `data:${data.mimeType};base64,${data.fileBase64}`,
            },
          },
        ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      if (aiResponse.status === 429) {
        throw new Error("تجاوزت حد الطلبات. أعد المحاولة بعد قليل.");
      }
      if (aiResponse.status === 402) {
        throw new Error("نفد رصيد التحليل الذكي. تواصل مع الإدارة.");
      }
      throw new Error("فشل التحليل الذكي: " + errText.slice(0, 200));
    }

    const aiData = await aiResponse.json();
    const content = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<ExtractedReport>;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = String(content).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const clean = (v: unknown, max = 600) =>
      String(v ?? "").trim().slice(0, max);
    const pct = Math.max(0, Math.min(100, Math.round(Number(parsed.completion_percent) || 0)));
    const dateStr = String(parsed.execution_date ?? "").trim();
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : "";

    const result: ExtractedReport = {
      action_taken: clean(parsed.action_taken, 2000),
      outcomes: clean(parsed.outcomes, 2000),
      completion_percent: pct,
      challenges: clean(parsed.challenges, 2000),
      recommendations: clean(parsed.recommendations, 2000),
      execution_date: validDate,
      attachments_note: clean(parsed.attachments_note, 500),
    };

    return { report: result };
  });