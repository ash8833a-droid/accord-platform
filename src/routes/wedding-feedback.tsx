import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Heart, Sparkles, CheckCircle2, UtensilsCrossed, CalendarRange, HandHeart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/wedding-feedback")({
  component: WeddingFeedbackPage,
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
    tone: "from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-700",
  },
  {
    key: "program_score",
    title: "٢. البرامج والفقرات",
    hint: "تنوع الفقرات، التزام الوقت، جودة الصوت والإضاءة، تفاعل الحضور.",
    icon: CalendarRange,
    tone: "from-violet-500/15 to-violet-500/5 border-violet-500/30 text-violet-700",
  },
  {
    key: "hospitality_score",
    title: "٣. الضيافة والعشاء",
    hint: "جودة الطعام، كفاية الكميات، ترتيب الموائد، نظافة المكان.",
    icon: UtensilsCrossed,
    tone: "from-amber-500/15 to-amber-500/5 border-amber-500/30 text-amber-700",
  },
  {
    key: "overall_score",
    title: "٤. الانطباع العام",
    hint: "الانطباع الكلي عن الزفاف الجماعي وروح العائلة وقابلية حضور المرات القادمة.",
    icon: Heart,
    tone: "from-rose-500/15 to-rose-500/5 border-rose-500/30 text-rose-700",
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
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-emerald-50 via-amber-50 to-rose-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-elegant p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
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
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-emerald-50 via-amber-50 to-rose-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-amber-500 text-white mx-auto flex items-center justify-center shadow-elegant">
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold">استبيان تقييم الزواج الجماعي</h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            رأيك يهمّنا… شاركنا تقييمك لأركان الحفل الأربعة لنطوّر تجربتنا في الحفلات القادمة.
          </p>
        </div>

        <div className="space-y-4">
          {QUESTIONS.map((q) => {
            const Icon = q.icon;
            return (
              <div
                key={q.key}
                className={`rounded-2xl border-2 bg-gradient-to-br ${q.tone} p-5 shadow-soft bg-white/70 backdrop-blur`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-soft">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-base">{q.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{q.hint}</p>
                  </div>
                </div>
                <Stars value={scores[q.key]} onChange={(v) => setScores((s) => ({ ...s, [q.key]: v }))} />
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border bg-white/80 backdrop-blur p-5 space-y-4 shadow-soft">
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
          className="w-full h-12 text-base bg-gradient-to-l from-emerald-600 to-amber-500 text-white shadow-elegant"
        >
          {submitting ? "جاري الإرسال…" : "إرسال التقييم"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">جميع التقييمات سرية ولا تُعرض إلا للجنة الجودة والإدارة.</p>
      </div>
    </div>
  );
}