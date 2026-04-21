// Edge Function: استخراج أسماء المساهمين من ملف PDF/صورة باستخدام Lovable AI
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FAMILY_BRANCHES = [
  "آل محمد",
  "العرجان",
  "الشرايرة",
  "آل بريك",
  "القدحان",
  "القفزان",
  "أبناء سعد سليم",
  "آل رداد",
  "عتيق وأبناؤه",
  "آل سالم",
  "آل عبدالرحمن عبدالرزاق وأبناؤه",
  "أبناء سليم بن عبدالله",
];

interface ExtractedRow {
  full_name: string;
  family_branch: string;
  amount: number;
}

function matchBranch(input: string): string | null {
  const cleaned = (input || "").trim();
  if (!cleaned) return null;
  for (const b of FAMILY_BRANCHES) {
    if (b === cleaned || b.includes(cleaned) || cleaned.includes(b)) return b;
  }
  const aliases: Record<string, string> = {
    "الشرايره": "الشرايرة",
    "عتيق وابناؤه": "عتيق وأبناؤه",
    "أبناء سعد بن سليم": "أبناء سعد سليم",
    "آل عبدالرحمن": "آل عبدالرحمن عبدالرزاق وأبناؤه",
    "عبدالرازق وأبناؤه": "أبناء سليم بن عبدالله",
    "عبدالرازق": "أبناء سليم بن عبدالله",
  };
  return aliases[cleaned] || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY غير مهيأ" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileBase64, mimeType, hijriYear, defaultAmount } = await req.json();

    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "الملف مطلوب" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const branchList = FAMILY_BRANCHES.map((b, i) => `${i + 1}) ${b}`).join("\n");

    const systemPrompt = `أنت مساعد لاستخراج أسماء المساهمين من ملفات الزواج الجماعي بدقة عالية.

الفروع العائلية المعتمدة (يجب أن يكون family_branch واحداً منها بالحرف نفسه):
${branchList}

قواعد:
- استخرج كل اسم مساهم في سجل منفصل.
- family_branch: طابق اسم الفرع تماماً مع القائمة. "الشرايره"="الشرايرة"، "عتيق وابناؤه"="عتيق وأبناؤه"، "أبناء سعد بن سليم"="أبناء سعد سليم"، "آل عبدالرحمن" أو "عبدالرحمن عبدالرزاق"="آل عبدالرحمن عبدالرزاق وأبناؤه"، "عبدالرازق وأبناؤه"="أبناء سليم بن عبدالله".
- amount: المبلغ بالريال لكل مساهم. إذا قال السطر "8 × 300 = 2400" فالمبلغ لكل مساهم = 300. إذا لم يُذكر مبلغ صريح استخدم ${defaultAmount || 300}.
- تجاهل أسماء العرسان وعناوين الصفحات والإجماليات والبنود التي لا تحتوي أسماء صريحة.
- نظّف الاسم من الأرقام والشرطات في البداية.

أعد JSON فقط:
{"rows":[{"full_name":"...","family_branch":"...","amount":300}]}`;

    const userContent = mimeType.startsWith("image/")
      ? [
          { type: "text", text: "استخرج جميع أسماء المساهمين من الصورة." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
        ]
      : [
          { type: "text", text: "استخرج جميع أسماء المساهمين من الملف." },
          { type: "file", file: { filename: "document", file_data: `data:${mimeType};base64,${fileBase64}` } },
        ];

    console.log(`[extract-shareholders] mime=${mimeType} year=${hijriYear}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
      console.error("[extract-shareholders] AI error", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "تجاوزت حد الطلبات. أعد المحاولة بعد قليل." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "نفد رصيد الذكاء الاصطناعي. يُرجى الشحن من إعدادات Lovable Cloud." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "فشل الاستخراج: " + errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      .filter((r) => r.full_name && r.family_branch)
      .map((r) => {
        const branch = FAMILY_BRANCHES.includes(r.family_branch)
          ? r.family_branch
          : matchBranch(r.family_branch);
        return {
          full_name: String(r.full_name).trim().replace(/^[\d\-\.\)\s]+/, "").slice(0, 120),
          family_branch: branch,
          amount: Number(r.amount) > 0 ? Number(r.amount) : (defaultAmount || 300),
          hijri_year: hijriYear || 1447,
        };
      })
      .filter((r) => r.family_branch && r.full_name.length > 1);

    console.log(`[extract-shareholders] extracted=${normalized.length}`);

    return new Response(JSON.stringify({ rows: normalized, count: normalized.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[extract-shareholders] error", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});