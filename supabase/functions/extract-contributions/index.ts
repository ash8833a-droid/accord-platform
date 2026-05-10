// Edge Function: استخراج بيانات مساهمات أفراد القبيلة من PDF/صورة باستخدام Lovable AI
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedRow {
  donor_name: string;
  amount: number;
  contribution_date: string; // YYYY-MM-DD
}

function normalizeDate(input: string | null | undefined, fallback: string): string {
  if (!input) return fallback;
  const s = String(input).trim();
  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY غير مهيأ" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileBase64, mimeType, defaultDate } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "الملف مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const fallbackDate = defaultDate || today;

    const systemPrompt = `أنت مساعد متخصص لاستخراج بيانات مساهمات مالية من كشوف المناديب في برنامج الزواج الجماعي.

المطلوب: استخراج كل مساهمة في سجل منفصل يحتوي:
- donor_name: اسم المتبرع/المساهم كاملاً (نظّفه من الأرقام والشرطات في البداية).
- amount: مبلغ المساهمة بالريال السعودي (رقم فقط، بدون عملة).
- contribution_date: تاريخ المساهمة بصيغة YYYY-MM-DD. إن لم يُذكر تاريخ، استخدم: ${fallbackDate}.

قواعد:
- تجاهل الإجماليات والعناوين والصفوف الفارغة.
- تجاهل أي صف لا يحتوي اسماً واضحاً ومبلغاً موجباً.
- إن كان الصف "8 × 300 = 2400" استخرج 8 سجلات منفصلة بمبلغ 300 لكل سجل (إن أمكن معرفة الأسماء، وإلا تجاهل).

أعد JSON فقط بالشكل:
{"rows":[{"donor_name":"...","amount":300,"contribution_date":"2026-05-10"}]}`;

    const userContent = mimeType.startsWith("image/")
      ? [
          { type: "text", text: "استخرج جميع المساهمات من الصورة." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
        ]
      : [
          { type: "text", text: "استخرج جميع المساهمات من الملف." },
          { type: "file", file: { filename: "document", file_data: `data:${mimeType};base64,${fileBase64}` } },
        ];

    console.log(`[extract-contributions] mime=${mimeType} fallback=${fallbackDate}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
      console.error("[extract-contributions] AI error", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "تجاوزت حد الطلبات. أعد المحاولة بعد قليل." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "نفد رصيد الذكاء الاصطناعي. يُرجى الشحن من إعدادات Lovable Cloud." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "فشل الاستخراج: " + errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content ?? "{}";
    let parsed: { rows: ExtractedRow[] };
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : { rows: [] };
    }

    const normalized = (parsed.rows || [])
      .filter((r) => r.donor_name && Number(r.amount) > 0)
      .map((r) => ({
        donor_name: String(r.donor_name).trim().replace(/^[\d\-\.\)\s]+/, "").slice(0, 120),
        amount: Number(r.amount),
        contribution_date: normalizeDate(r.contribution_date, fallbackDate),
      }))
      .filter((r) => r.donor_name.length > 1 && r.amount > 0);

    console.log(`[extract-contributions] extracted=${normalized.length}`);

    return new Response(JSON.stringify({ rows: normalized, count: normalized.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[extract-contributions] error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});