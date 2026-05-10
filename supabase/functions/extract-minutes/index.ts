// Edge Function: استخراج بيانات محضر اجتماع منظّم من ملف PDF / صورة / Word باستخدام Lovable AI
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Extracted {
  title?: string;
  meeting_date?: string;     // YYYY-MM-DD
  start_time?: string;
  end_time?: string;
  location?: string;
  recorder_name?: string;
  attendees?: string[];
  agenda_items?: string[];
  recommendations?: string[];
  notes?: string;
}

function normDate(s: string | undefined, fallback: string): string {
  if (!s) return fallback;
  const t = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const dt = new Date(t);
  return isNaN(dt.getTime()) ? fallback : dt.toISOString().slice(0, 10);
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

    const { fileBase64, mimeType, committeeName } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "الملف مطلوب" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `أنت مساعد متخصص في استخراج بيانات محاضر الاجتماعات الرسمية باللغة العربية.
اللجنة الحالية: "${committeeName ?? "—"}".

استخرج من المستند الحقول التالية وأعدها بصيغة JSON صالحة فقط:
- title: عنوان المحضر/موضوع الاجتماع.
- meeting_date: تاريخ الاجتماع بصيغة YYYY-MM-DD (لو غير موجود استخدم ${today}).
- start_time: وقت بداية الاجتماع (HH:MM) إن وُجد.
- end_time: وقت نهاية الاجتماع (HH:MM) إن وُجد.
- location: مكان الاجتماع (قاعة / منصة / حضوري ...).
- recorder_name: اسم كاتب المحضر/أمين الاجتماع.
- attendees: مصفوفة بأسماء الحضور (بدون أرقام أو شرطات في البداية).
- agenda_items: مصفوفة ببنود/مواضيع الاجتماع، كل بند جملة كاملة وواضحة.
- recommendations: مصفوفة بالتوصيات أو القرارات الناتجة عن الاجتماع.
- notes: أي ملاحظات إضافية مختصرة.

قواعد:
- لا تخترع بيانات. إن لم تجد حقلاً اتركه فارغاً (سلسلة فارغة أو مصفوفة فارغة).
- نظّف النصوص من الترقيم الزائد والأقواس والنقاط في البداية.
- اجعل العناصر داخل المصفوفات قصيرة وواضحة، كل عنصر سطر واحد.

أعد JSON فقط بالشكل:
{"title":"","meeting_date":"YYYY-MM-DD","start_time":"","end_time":"","location":"","recorder_name":"","attendees":[],"agenda_items":[],"recommendations":[],"notes":""}`;

    const userContent = mimeType.startsWith("image/")
      ? [
          { type: "text", text: "استخرج بيانات المحضر من الصورة." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
        ]
      : [
          { type: "text", text: "استخرج بيانات المحضر من الملف." },
          { type: "file", file: { filename: "minutes", file_data: `data:${mimeType};base64,${fileBase64}` } },
        ];

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
      console.error("[extract-minutes] AI error", aiResponse.status, errText);
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
    let parsed: Extracted;
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const cleanArr = (arr: unknown): string[] =>
      Array.isArray(arr)
        ? arr
            .map((x) => String(x ?? "").trim().replace(/^[\d\-\.\)\s•·]+/, "").trim())
            .filter((x) => x.length > 1)
            .slice(0, 50)
        : [];

    const out = {
      title: (parsed.title ?? "").toString().trim().slice(0, 200),
      meeting_date: normDate(parsed.meeting_date, today),
      start_time: (parsed.start_time ?? "").toString().trim().slice(0, 10),
      end_time: (parsed.end_time ?? "").toString().trim().slice(0, 10),
      location: (parsed.location ?? "").toString().trim().slice(0, 200),
      recorder_name: (parsed.recorder_name ?? "").toString().trim().slice(0, 120),
      attendees: cleanArr(parsed.attendees),
      agenda_items: cleanArr(parsed.agenda_items),
      recommendations: cleanArr(parsed.recommendations),
      notes: (parsed.notes ?? "").toString().trim().slice(0, 2000),
    };

    return new Response(JSON.stringify(out), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[extract-minutes] error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});