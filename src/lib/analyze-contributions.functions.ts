import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  fileBase64: z.string().min(10).max(20_000_000),
  mimeType: z.string().min(3).max(120),
  defaultAmount: z.number().int().min(1).max(1_000_000).optional(),
});

interface ExtractedRow {
  full_name: string;
  amount: number;
  notes?: string;
}

export const analyzeContributionsFile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("خدمة التحليل غير مهيأة حالياً. تواصل مع الإدارة.");
    }

    const defaultAmount = data.defaultAmount ?? 300;

    const systemPrompt = `أنت مساعد ذكي لاستخراج أسماء ومبالغ المساهمين في الزواج الجماعي من صور أو ملفات (PDF / نص / جدول).

قواعد دقيقة:
- استخرج كل مساهم في سجل منفصل (اسم + مبلغ + ملاحظة إن وُجدت).
- full_name: الاسم الكامل بالعربية، نظيفاً من الأرقام والشرطات في البداية، بدون كلمات مثل "أ/" أو "السيد".
- amount: المبلغ بالريال السعودي لكل مساهم. إذا كان السطر مثل "5 × 300 = 1500" فالمبلغ لكل مساهم = 300. إذا لم يُذكر مبلغ صريح استخدم ${defaultAmount}.
- إذا كانت هناك ملاحظة قصيرة بجانب الاسم (مثل: غائب، آجل، تحويل بنكي) ضعها في notes، وإلا اتركها فارغة.
- تجاهل العناوين، الإجماليات، التواريخ، التذييلات، وأسماء العرسان أو الفروع.
- لا تكرر نفس الاسم.

أعد JSON فقط بهذا الشكل بدون أي شرح:
{"rows":[{"full_name":"...","amount":300,"notes":""}]}`;

    const userContent = data.mimeType.startsWith("image/")
      ? [
          { type: "text", text: "استخرج جميع أسماء ومبالغ المساهمين من هذه الصورة." },
          {
            type: "image_url",
            image_url: { url: `data:${data.mimeType};base64,${data.fileBase64}` },
          },
        ]
      : [
          { type: "text", text: "استخرج جميع أسماء ومبالغ المساهمين من هذا الملف." },
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
        model: "google/gemini-2.5-pro",
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
    let parsed: { rows?: ExtractedRow[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = String(content).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { rows: [] };
    }

    const rows = (parsed.rows || [])
      .map((r) => ({
        full_name: String(r.full_name || "")
          .trim()
          .replace(/^[\d\-\.\)\s]+/, "")
          .slice(0, 120),
        amount:
          Number(r.amount) > 0 ? Math.round(Number(r.amount)) : defaultAmount,
        notes: r.notes ? String(r.notes).trim().slice(0, 200) : "",
      }))
      .filter((r) => r.full_name.length >= 2);

    // إزالة التكرار
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      const key = r.full_name.replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { rows: unique, count: unique.length };
  });