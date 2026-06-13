import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Heart, Sparkles, CheckCircle2, UtensilsCrossed, CalendarRange, HandHeart } from "lucide-react";
import { toast } from "sonner";
import weddingLogo from "@/assets/wedding-logo.png.asset.json";

const BRAND_GOLD = "#C9A24C";
const BRAND_TEAL = "#0E7C6B";

export const Route = createFileRoute("/wedding-feedback")({
  component: WeddingFeedbackPage,
  head: () => {
    const title = "رأيك يهمّنا | الزواج الجماعي";
    const description = "شاركنا تقييمك لتجربة أفضل";
    const image = "https://www.lajnat-zawaj.org/__l5e/assets-v1/6be359cf-47ce-4a4f-806d-4205d334eaf6/wedding-logo.png";
    const url = "https://www.lajnat-zawaj.org/wedding-feedback";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { property: "og:image:alt", content: "شعار الزواج الجماعي" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

interface Q {
  key: "organization_score" | "hospitality_score" | "program_score" | "overall_score";
  title: string;
  hint: string;
  icon: any;
  tone: string;
}

const QUESTIONS: Q[] = [
  {
    key: "organization_score",
    title: "١. التنظيم والاستقبال",
    hint: "وضوح الإرشادات، حسن الاستقبال، تنظيم الدخول والمواقف، إدارة الحشد.",
    icon: HandHeart,
    tone: "teal",
  },
  {
    key: "program_score",
    title: "٢. البرامج والفقرات",
    hint: "تنوع الفقرات، التزام الوقت، جودة الصوت والإضاءة، تفاعل الحضور.",
    icon: CalendarRange,
    tone: "gold",
  },
  {
    key: "hospitality_score",
    title: "٣. الضيافة والعشاء",
    hint: "جودة الطعام، كفاية الكميات، ترتيب الموائد، نظافة المكان.",
    icon: UtensilsCrossed,
    tone: "teal",
  },
  {
    key: "overall_score",
    title: "٤. الانطباع العام",
    hint: "الانطباع الكلي عن الزفاف الجماعي وروح العائلة وقابلية حضور المرات القادمة.",
    icon: Heart,
    tone: "gold",
  },
];

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 justify-center" dir="ltr">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-1 transition-transform hover:scale-110 active:scale-95"
          aria-label={`${n} نجوم`}
        >
          <Star
            className={`h-9 w-9 ${n <= value ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40"}`}
          />
        </button>
      ))}
    </div>
  );
}

function WeddingFeedbackPage() {
  const [scores, setScores] = useState<Record<Q["key"], number>>({
    organization_score: 0,
    hospitality_score: 0,
    program_score: 0,
    overall_score: 0,
  });
  const [suggestions, setSuggestions] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    for (const q of QUESTIONS) {
      if (!scores[q.key]) {
        toast.error("يرجى تقييم جميع الأسئلة الأربعة");
        return;
      }
    }
    setSubmitting(true);
    const { error } = await supabase.from("wedding_feedback").insert({
      ...scores,
      suggestions: suggestions.trim() || null,
      respondent_role: role.trim() || null,
      respondent_phone: phone.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("تعذر إرسال التقييم", { description: error.message });
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div dir="rtl" className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border rounded-3xl shadow-elegant p-8 text-center space-y-4">
          <img src={weddingLogo.url} alt="شعار الزواج الجماعي" className="h-20 w-auto mx-auto" />
          <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: `${BRAND_TEAL}14`, color: BRAND_TEAL }}>
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold">شكراً جزيلاً لك</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            تم استلام تقييمك بنجاح، ملاحظاتك ستساهم بإذن الله في تطوير حفلات الزواج الجماعي القادمة.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-3 pt-2">
          <img src={weddingLogo.url} alt="شعار الزواج الجماعي" className="h-24 sm:h-28 w-auto mx-auto" />
          <div className="mx-auto h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${BRAND_GOLD}, transparent)` }} />
          <h1 className="text-2xl sm:text-3xl font-extrabold" style={{ color: BRAND_TEAL }}>استبيان تقييم الزواج الجماعي الثاني عشر 1448هـ</h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            رأيك يهمّنا… شاركنا تقييمك لأركان الحفل الأربعة لنطوّر تجربتنا في الحفلات القادمة.
          </p>
        </div>

        <div className="space-y-4">
          {QUESTIONS.map((q) => {
            const Icon = q.icon;
            const color = q.tone === "gold" ? BRAND_GOLD : BRAND_TEAL;
            return (
              <div
                key={q.key}
                className="rounded-2xl border bg-white p-5 shadow-soft"
                style={{ borderColor: `${color}33` }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{ backgroundColor: `${color}12`, borderColor: `${color}33`, color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-base" style={{ color }}>{q.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{q.hint}</p>
                  </div>
                </div>
                <Stars value={scores[q.key]} onChange={(v) => setScores((s) => ({ ...s, [q.key]: v }))} />
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border bg-white p-5 space-y-4 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="suggestions" className="font-bold">مقترحاتك للتحسين (اختياري)</Label>
            <Textarea
              id="suggestions"
              value={suggestions}
              onChange={(e) => setSuggestions(e.target.value)}
              placeholder="شاركنا أي ملاحظة أو مقترح يساعدنا على تطوير الحفلات القادمة…"
              rows={4}
              maxLength={1000}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="role" className="text-xs">صفتك (اختياري)</Label>
              <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="ضيف / قريب / عريس…" maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs">رقم الجوال (اختياري)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" maxLength={20} inputMode="tel" />
            </div>
          </div>
        </div>

        <Button
          onClick={submit}
          disabled={submitting}
          className="w-full h-12 text-base text-white shadow-elegant border-0"
          style={{ background: `linear-gradient(90deg, ${BRAND_TEAL}, ${BRAND_GOLD})` }}
        >
          {submitting ? "جاري الإرسال…" : "إرسال التقييم"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">جميع التقييمات سرية ولا تُعرض إلا للجنة الجودة والإدارة.</p>
      </div>
    </div>
  );
}