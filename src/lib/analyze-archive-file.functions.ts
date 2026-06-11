import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  storage_path: z.string().min(1),
  filename: z.string().min(1).max(500),
  mime_type: z.string().max(200).optional().default(""),
  description: z.string().max(2000).optional().default(""),
  wedding_year: z.number().int().min(2000).max(2100),
});

export type ArchiveCategory = "grooms" | "media" | "programs" | "finance" | "organization";

export interface ArchiveAnalysis {
  category: ArchiveCategory;
  category_label: string;
  suggested_title: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

const CATEGORY_LABELS: Record<ArchiveCategory, string> = {
  grooms: "صور العرسان",
  media: "الجانب الإعلامي",
  programs: "البرامج والفقرات",
  finance: "الجانب المالي",
  organization: "التنظيم والتحسين",
};

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

export const analyzeArchiveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Create a short-lived signed URL so the AI gateway / our server can fetch the file.
    const { data: signed, error: signErr } = await supabase
      .storage.from("wedding-archive")
      .createSignedUrl(data.storage_path, 60 * 5);
    if (signErr || !signed?.signedUrl) {
      throw new Error("تعذر قراءة الملف للتحليل");
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("خدمة التحليل غير مهيأة. تواصل مع الإدارة.");

    const systemPrompt = `أنت مساعد ذكي لأرشيف لجنة الزواج الجماعي للعائلة. مهمتك تصنيف المرفقات وتسميتها وتلخيصها لتسهيل البحث في الأرشيف.

التصنيفات المتاحة:
- grooms: صور العرسان وألبومات حفلات الزواج (وجوه، صور جماعية، صور الكوشة، صور تذكارية للعرسان).
- media: الجانب الإعلامي (تغطيات صحفية، فيديوهات، نشرات، إعلانات، تصاميم، بوسترات، شعارات، لقطات شاشة من وسائل التواصل).
- programs: البرامج والفقرات (أجندة الحفل، جدول الفقرات، الكلمات، السيناريو، خطط الأنشطة المصاحبة).
- finance: الجانب المالي (ميزانيات، تقارير مصروفات، فواتير، إيصالات، مساهمات، أسهم، تقارير ختامية مالية، استبانات مالية).
- organization: التنظيم والتحسين (خطط تنظيم، محاضر، تقارير لجان، دروس مستفادة، مقترحات تطوير، استبانات رضا، توصيات).

المطلوب: حلّل الملف المرفق (صورة/PDF/ملف) وأعد JSON فقط بهذا الشكل:
{
  "category": "grooms" | "media" | "programs" | "finance" | "organization",
  "suggested_title": "عنوان عربي مختصر وواضح (3-8 كلمات) يصف الملف",
  "summary": "ملخص في 1-2 جملة عن محتوى الملف ولماذا يندرج تحت هذا التصنيف",
  "confidence": "high" | "medium" | "low",
  "reasoning": "سبب التصنيف بإيجاز (سطر واحد)"
}

قواعد:
- إن لم تتمكن من فتح الملف، استند لاسم الملف والوصف.
- العنوان عربي فصيح بدون رموز أو امتدادات.
- لا تُرجع أي نص خارج JSON.
- اختر تصنيفاً واحداً فقط، الأكثر مطابقة.`;

    const userText =
      `سنة الحفل: ${data.wedding_year}\n` +
      `اسم الملف: ${data.filename}\n` +
      `نوع الملف: ${data.mime_type || "غير محدد"}\n` +
      (data.description ? `وصف من المُرسل: ${data.description}\n` : "") +
      `صنّف هذا الملف ضمن أحد التصنيفات الخمسة.`;

    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
      | { type: "file"; file: { filename: string; file_data: string } };

    const content: ContentBlock[] = [{ type: "text", text: userText }];

    try {
      if (isImage(data.mime_type, data.filename)) {
        content.push({ type: "image_url", image_url: { url: signed.signedUrl } });
      } else if (isPdf(data.mime_type, data.filename)) {
        const r = await fetch(signed.signedUrl);
        if (r.ok) {
          const buf = new Uint8Array(await r.arrayBuffer());
          // Cap at ~8MB to keep request light.
          if (buf.byteLength <= 8 * 1024 * 1024) {
            const b64 = btoa(String.fromCharCode(...buf));
            content.push({
              type: "file",
              file: {
                filename: data.filename,
                file_data: `data:application/pdf;base64,${b64}`,
              },
            });
          }
        }
      } else if (isText(data.mime_type, data.filename)) {
        const r = await fetch(signed.signedUrl);
        if (r.ok) {
          const txt = (await r.text()).slice(0, 12000);
          content.push({ type: "text", text: "محتوى الملف النصي:\n" + txt });
        }
      }
    } catch {
      // Fall through with text-only content; AI will rely on filename/description.
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
    let parsed: Partial<ArchiveAnalysis> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = String(raw).match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const allowed: ArchiveCategory[] = ["grooms", "media", "programs", "finance", "organization"];
    const cat = (allowed.includes(parsed.category as ArchiveCategory)
      ? parsed.category
      : "organization") as ArchiveCategory;
    const conf = (["high", "medium", "low"].includes(String(parsed.confidence))
      ? parsed.confidence
      : "medium") as ArchiveAnalysis["confidence"];

    const clean = (v: unknown, max = 400) => String(v ?? "").trim().slice(0, max);

    const result: ArchiveAnalysis = {
      category: cat,
      category_label: CATEGORY_LABELS[cat],
      suggested_title: clean(parsed.suggested_title, 120) || data.filename.replace(/\.[^.]+$/, ""),
      summary: clean(parsed.summary, 600),
      confidence: conf,
      reasoning: clean(parsed.reasoning, 300),
    };

    return result;
  });