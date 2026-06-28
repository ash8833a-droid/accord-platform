import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  storage_path: z.string().min(1).max(800).optional(),
  filename: z.string().min(1).max(500).optional(),
  mime_type: z.string().max(200).optional().default(""),
  pasted_text: z.string().max(60_000).optional(),
  committee_name: z.string().max(200).optional().default(""),
});

export interface PlanAnalysis {
  summary: string;
  objectives: string[];
  milestones: string[];
  responsibilities: string[];
  risks: string[];
  recommendations: string[];
}

function isImage(mime: string, name: string) {
  if (mime.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(name);
}
function isPdf(mime: string, name: string) {
  return mime === "application/pdf" || /\.pdf$/i.test(name);
}
function isText(mime: string, name: string) {
  if (mime.startsWith("text/")) return true;
  return /\.(txt|md|csv|json|html|xml|rtf)$/i.test(name);
}

export const analyzePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("خدمة التحليل غير مهيأة. تواصل مع الإدارة.");
    if (!data.storage_path && !data.pasted_text?.trim()) {
      throw new Error("لا يوجد محتوى للتحليل");
    }

    const systemPrompt = `أنت مساعد ذكي متخصص في تحليل الخطط التشغيلية للجان الزواج الجماعي.
مهمتك: قراءة الخطة المرفقة (نصاً أو ملفاً) واستخراج بنيتها بأسلوب مهني عربي راقٍ.

أعد JSON فقط بهذا الشكل بدون أي شرح خارجي:
{
  "summary": "ملخّص في 2-3 جمل يوضح هدف الخطة وأبرز ملامحها",
  "objectives": ["هدف 1", "هدف 2", ...],
  "milestones": ["مرحلة/تاريخ مهم 1", ...],
  "responsibilities": ["دور أو جهة مسؤولة 1", ...],
  "risks": ["مخاطرة أو فجوة 1", ...],
  "recommendations": ["توصية للتحسين 1", ...]
}

قواعد:
- اجعل كل عنصر جملة قصيرة واضحة (لا تتجاوز 25 كلمة).
- إن لم تجد عنصراً واضحاً، أعد مصفوفة فارغة [].
- اللغة عربية فصحى مهنية.
- لا تُرجع أي نص خارج JSON.`;

    const userIntro =
      (data.committee_name ? `اللجنة: ${data.committee_name}\n` : "") +
      (data.filename ? `اسم الملف: ${data.filename}\n` : "") +
      `حلّل الخطة التالية واستخرج بنيتها.`;

    type Block =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
      | { type: "file"; file: { filename: string; file_data: string } };

    const content: Block[] = [{ type: "text", text: userIntro }];

    if (data.pasted_text && data.pasted_text.trim()) {
      content.push({
        type: "text",
        text: "محتوى الخطة الملصق:\n" + data.pasted_text.slice(0, 50_000),
      });
    }

    if (data.storage_path) {
      const { supabase } = context;
      const { data: signed, error: signErr } = await supabase.storage
        .from("reports")
        .createSignedUrl(data.storage_path, 60 * 5);
      if (signErr || !signed?.signedUrl) {
        throw new Error("تعذر قراءة الملف للتحليل");
      }
      const mime = data.mime_type ?? "";
      const name = data.filename ?? "plan";
      try {
        if (isImage(mime, name)) {
          content.push({ type: "image_url", image_url: { url: signed.signedUrl } });
        } else if (isPdf(mime, name)) {
          const r = await fetch(signed.signedUrl);
          if (r.ok) {
            const buf = new Uint8Array(await r.arrayBuffer());
            if (buf.byteLength <= 8 * 1024 * 1024) {
              const b64 = btoa(String.fromCharCode(...buf));
              content.push({
                type: "file",
                file: {
                  filename: name,
                  file_data: `data:application/pdf;base64,${b64}`,
                },
              });
            }
          }
        } else if (isText(mime, name)) {
          const r = await fetch(signed.signedUrl);
          if (r.ok) {
            const txt = (await r.text()).slice(0, 40_000);
            content.push({ type: "text", text: "محتوى الملف النصي:\n" + txt });
          }
        }
      } catch {
        // fall through with whatever content we have
      }
    }

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
          { role: "user", content },
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
    const raw = aiData?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Partial<PlanAnalysis> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const arr = (v: unknown): string[] =>
      Array.isArray(v)
        ? v.map((x) => String(x ?? "").trim()).filter((x) => x.length > 0).slice(0, 12)
        : [];

    const result: PlanAnalysis = {
      summary: String(parsed.summary ?? "").trim().slice(0, 800),
      objectives: arr(parsed.objectives),
      milestones: arr(parsed.milestones),
      responsibilities: arr(parsed.responsibilities),
      risks: arr(parsed.risks),
      recommendations: arr(parsed.recommendations),
    };
    return result;
  });