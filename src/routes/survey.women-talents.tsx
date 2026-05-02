import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { FAMILY_BRANCHES } from "@/lib/family-branches";
import {
  Loader2,
  CheckCircle2,
  Sparkles,
  Heart,
  Palette,
  Camera,
  Video,
  Pen,
  Code2,
  Megaphone,
  Languages,
  GraduationCap,
  Clock,
  User,
  Phone,
  MapPin,
  Send,
  Star,
  Gem,
} from "lucide-react";

export const Route = createFileRoute("/survey/women-talents")({
  component: WomenTalentsSurvey,
  head: () => {
    const url = "https://lajnat-zawaj.org/survey/women-talents";
    return {
      meta: [
        { title: "استبيان مواهب بنات العائلة — لجنة الزواج الجماعي" },
        {
          name: "description",
          content:
            "ندعوك للمشاركة في صناعة فرحة العائلة — شاركينا مهاراتك وخبراتك في التقنية والتصميم والتوثيق والإعلام.",
        },
        { property: "og:title", content: "🌸 ندعوكِ للمشاركة في صناعة فرحة العائلة" },
        {
          property: "og:description",
          content:
            "اللجنة النسائية تبحث عن المبدعات والمميزات في مجالات التصميم، التصوير، التقنية والكتابة. شاركينا!",
        },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

const SKILL_OPTIONS = [
  { id: "graphic_design", label: "تصميم جرافيك", icon: Palette },
  { id: "video_editing", label: "مونتاج فيديو", icon: Video },
  { id: "photography", label: "تصوير فوتوغرافي", icon: Camera },
  { id: "content_writing", label: "كتابة محتوى", icon: Pen },
  { id: "social_media", label: "إدارة سوشيال ميديا", icon: Megaphone },
  { id: "tech", label: "مهارات تقنية / برمجة", icon: Code2 },
  { id: "translation", label: "ترجمة", icon: Languages },
  { id: "training", label: "تدريب وإلقاء", icon: GraduationCap },
];

const INTEREST_AREAS = [
  "تصميم بطاقات الدعوة وهوية الحفل",
  "توثيق وأرشفة الفعاليات",
  "تغطية الحفل (تصوير/مونتاج)",
  "إدارة حسابات التواصل",
  "تنسيق المكان والديكور",
  "استقبال الضيفات",
  "إعداد الفقرات والبرامج",
  "كتابة المحتوى والتقارير",
];

const TIME_SLOTS = ["صباحاً", "ظهراً", "مساءً", "ليلاً", "عطلة نهاية الأسبوع"];

const isValidSaPhone = (p: string) => /^05\d{8}$/.test(p.trim());

function WomenTalentsSurvey() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [familyBranch, setFamilyBranch] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [education, setEducation] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [tools, setTools] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [previousWork, setPreviousWork] = useState("");
  const [certifications, setCertifications] = useState("");
  const [interestAreas, setInterestAreas] = useState<string[]>([]);
  const [weeklyHours, setWeeklyHours] = useState("");
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [motivation, setMotivation] = useState("");
  const [notes, setNotes] = useState("");

  const toggle = (
    arr: string[],
    setArr: (v: string[]) => void,
    val: string,
  ) => {
    setArr(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("الرجاء إدخال الاسم الكامل");
    if (!isValidSaPhone(phone))
      return toast.error("الرجاء إدخال رقم جوال سعودي صحيح يبدأ بـ 05");
    if (skills.length === 0)
      return toast.error("اختاري مهارة واحدة على الأقل");

    setSubmitting(true);
    try {
      const skillLabels = SKILL_OPTIONS.filter((s) => skills.includes(s.id)).map(
        (s) => s.label,
      );
      const { error } = await supabase.from("women_talent_responses").insert({
        full_name: fullName.trim(),
        age: age ? Number(age) : null,
        family_branch: familyBranch || null,
        phone: phone.trim(),
        city: city.trim() || null,
        marital_status: maritalStatus || null,
        education_level: education || null,
        specialization: specialization.trim() || null,
        skills: skillLabels,
        tools: tools.trim() || null,
        experience_years: experienceYears ? Number(experienceYears) : null,
        previous_work: previousWork.trim() || null,
        certifications: certifications.trim() || null,
        interest_areas: interestAreas,
        weekly_hours: weeklyHours || null,
        preferred_times: preferredTimes,
        motivation: motivation.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الإرسال. حاولي مجدداً.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-rose-100 via-fuchsia-100 to-amber-100"
      >
        <div className="max-w-lg w-full bg-white/90 backdrop-blur-xl rounded-3xl p-8 lg:p-12 shadow-2xl border border-white text-center animate-fade-up">
          <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-rose-400 via-fuchsia-500 to-amber-400 flex items-center justify-center shadow-xl mb-6">
            <CheckCircle2 className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-rose-600 via-fuchsia-600 to-amber-600 bg-clip-text text-transparent mb-3">
            شكراً جزيلاً لكِ! 🌸
          </h1>
          <p className="text-slate-700 leading-relaxed mb-6">
            وصلتنا بياناتك بنجاح، وسنتواصل معك قريباً عبر رقم جوالك للتنسيق.
            نحن سعداء بانضمامك لصُنّاع الفرحة في عائلتنا الكريمة.
          </p>
          <div className="flex items-center justify-center gap-2 text-amber-600">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold">اللجنة النسائية</span>
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen relative overflow-hidden bg-gradient-to-br from-rose-50 via-fuchsia-50 to-amber-50"
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-rose-300/40 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -left-32 w-96 h-96 rounded-full bg-fuchsia-300/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 w-96 h-96 rounded-full bg-amber-300/40 blur-3xl" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 lg:py-12">
        {/* Hero */}
        <div className="text-center mb-8 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/70 backdrop-blur-sm border border-rose-200 shadow-sm mb-4">
            <Heart className="h-4 w-4 text-rose-500 fill-rose-500" />
            <span className="text-xs font-semibold text-rose-700">
              دعوة خاصة لبنات العائلة
            </span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-extrabold leading-tight mb-3">
            <span className="bg-gradient-to-r from-rose-600 via-fuchsia-600 to-amber-600 bg-clip-text text-transparent">
              نبحث عنكِ 🌸
            </span>
          </h1>
          <p className="text-base lg:text-lg text-slate-700 max-w-xl mx-auto leading-relaxed">
            ساهمي معنا في صناعة فرحة العائلة. شاركينا مهاراتك في{" "}
            <span className="font-bold text-fuchsia-700">التصميم</span> و
            <span className="font-bold text-rose-700">التوثيق</span> و
            <span className="font-bold text-amber-700">التقنية</span> لنبني سوياً
            عملاً يليق بقبيلتنا.
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/80 p-6 lg:p-10 space-y-8"
        >
          {/* Section: Personal */}
          <SectionTitle icon={User} color="rose">
            البيانات الشخصية
          </SectionTitle>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="الاسم الكامل *">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: نورة محمد"
                required
                className="h-11 bg-white"
              />
            </Field>
            <Field label="العمر">
              <Input
                type="number"
                inputMode="numeric"
                min={14}
                max={80}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="مثال: 25"
                className="h-11 bg-white"
              />
            </Field>
            <Field label="رقم الجوال *" icon={Phone}>
              <Input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                required
                className="h-11 bg-white"
              />
            </Field>
            <Field label="المدينة" icon={MapPin}>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="مثال: الرياض"
                className="h-11 bg-white"
              />
            </Field>
            <Field label="الفرع العائلي">
              <Select value={familyBranch} onValueChange={setFamilyBranch}>
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue placeholder="اختاري الفرع" />
                </SelectTrigger>
                <SelectContent>
                  {FAMILY_BRANCHES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="الحالة الاجتماعية">
              <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue placeholder="اختاري" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">عزباء</SelectItem>
                  <SelectItem value="married">متزوجة</SelectItem>
                  <SelectItem value="other">غير ذلك</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Section: Education */}
          <SectionTitle icon={GraduationCap} color="fuchsia">
            المؤهل العلمي والتخصص
          </SectionTitle>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="المستوى التعليمي">
              <Select value={education} onValueChange={setEducation}>
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue placeholder="اختاري" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">طالبة مدرسة</SelectItem>
                  <SelectItem value="diploma">دبلوم</SelectItem>
                  <SelectItem value="bachelor">بكالوريوس</SelectItem>
                  <SelectItem value="master">ماجستير</SelectItem>
                  <SelectItem value="phd">دكتوراه</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="التخصص الدراسي / المهني">
              <Input
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="مثال: تصميم جرافيك / علوم حاسب"
                className="h-11 bg-white"
              />
            </Field>
          </div>

          {/* Section: Skills */}
          <SectionTitle icon={Sparkles} color="amber">
            مهاراتك وقدراتك *
          </SectionTitle>
          <p className="text-sm text-slate-600 -mt-4">
            اختاري كل ما يناسبك (يمكنك اختيار أكثر من مهارة)
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {SKILL_OPTIONS.map((skill) => {
              const Icon = skill.icon;
              const active = skills.includes(skill.id);
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => toggle(skills, setSkills, skill.id)}
                  className={`group relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    active
                      ? "border-fuchsia-500 bg-gradient-to-br from-rose-100 via-fuchsia-100 to-amber-100 shadow-lg scale-105"
                      : "border-slate-200 bg-white hover:border-rose-300 hover:shadow-md"
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${
                      active
                        ? "bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-rose-100 group-hover:text-rose-600"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-xs font-semibold text-center leading-tight ${
                      active ? "text-fuchsia-800" : "text-slate-700"
                    }`}
                  >
                    {skill.label}
                  </span>
                  {active && (
                    <CheckCircle2 className="absolute top-1 left-1 h-4 w-4 text-fuchsia-600" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="الأدوات/البرامج التي تتقنينها">
              <Input
                value={tools}
                onChange={(e) => setTools(e.target.value)}
                placeholder="مثال: Photoshop, Canva, CapCut"
                className="h-11 bg-white"
              />
            </Field>
            <Field label="سنوات الخبرة">
              <Select value={experienceYears} onValueChange={setExperienceYears}>
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue placeholder="اختاري" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">مبتدئة (تحت سنة)</SelectItem>
                  <SelectItem value="1">سنة واحدة</SelectItem>
                  <SelectItem value="2">سنتين</SelectItem>
                  <SelectItem value="3">3 سنوات</SelectItem>
                  <SelectItem value="5">5 سنوات أو أكثر</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="أعمال سابقة (روابط أو وصف مختصر)">
            <Textarea
              value={previousWork}
              onChange={(e) => setPreviousWork(e.target.value)}
              placeholder="ضعي روابط أعمالك على Behance/Instagram، أو وصفاً مختصراً لأبرز أعمالك"
              className="min-h-[90px] bg-white"
            />
          </Field>

          <Field label="دورات وشهادات">
            <Input
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              placeholder="مثال: دورة تصميم من إدراك، شهادة Google Digital Marketing"
              className="h-11 bg-white"
            />
          </Field>

          {/* Section: Interest areas */}
          <SectionTitle icon={Star} color="rose">
            ما المجالات التي تودّين المشاركة فيها؟
          </SectionTitle>
          <div className="grid sm:grid-cols-2 gap-2">
            {INTEREST_AREAS.map((area) => {
              const active = interestAreas.includes(area);
              return (
                <label
                  key={area}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                    active
                      ? "border-rose-400 bg-rose-50/80"
                      : "border-slate-200 bg-white hover:border-rose-200"
                  }`}
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={() =>
                      toggle(interestAreas, setInterestAreas, area)
                    }
                  />
                  <span className="text-sm text-slate-800">{area}</span>
                </label>
              );
            })}
          </div>

          {/* Section: Availability */}
          <SectionTitle icon={Clock} color="fuchsia">
            التفرغ والتواجد
          </SectionTitle>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="عدد الساعات أسبوعياً">
              <Select value={weeklyHours} onValueChange={setWeeklyHours}>
                <SelectTrigger className="h-11 bg-white">
                  <SelectValue placeholder="اختاري" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-3">1 - 3 ساعات</SelectItem>
                  <SelectItem value="4-7">4 - 7 ساعات</SelectItem>
                  <SelectItem value="8-15">8 - 15 ساعة</SelectItem>
                  <SelectItem value="15+">أكثر من 15 ساعة</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="الأوقات المفضلة (اختاري ما يناسبك)">
              <div className="flex flex-wrap gap-2 pt-1">
                {TIME_SLOTS.map((t) => {
                  const active = preferredTimes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        toggle(preferredTimes, setPreferredTimes, t)
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                        active
                          ? "bg-gradient-to-r from-rose-500 to-fuchsia-600 text-white border-transparent shadow"
                          : "bg-white text-slate-700 border-slate-200 hover:border-rose-300"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          {/* Section: Motivation */}
          <SectionTitle icon={Gem} color="amber">
            لمسة شخصية
          </SectionTitle>
          <Field label="ما الذي يحمسك للمشاركة معنا؟">
            <Textarea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="شاركينا دوافعك وما الذي تتمنين أن تضيفيه..."
              className="min-h-[100px] bg-white"
            />
          </Field>
          <Field label="ملاحظات إضافية (اختياري)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي شيء تودّين إخبارنا به"
              className="min-h-[70px] bg-white"
            />
          </Field>

          {/* Submit */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-14 text-base font-bold rounded-2xl bg-gradient-to-r from-rose-500 via-fuchsia-600 to-amber-500 hover:opacity-90 text-white shadow-xl border-0 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin ml-2" />
                  جارٍ الإرسال...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5 ml-2" />
                  إرسال البيانات
                </>
              )}
            </Button>
            <p className="text-center text-xs text-slate-500 mt-3">
              🔒 بياناتك محفوظة وسرّية، تُعرض فقط على رئيسة اللجنة النسائية
            </p>
          </div>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          © {new Date().getFullYear()} اللجنة النسائية — لجنة الزواج الجماعي
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  icon: Icon,
  color,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  color: "rose" | "fuchsia" | "amber";
}) {
  const map = {
    rose: "from-rose-500 to-rose-600",
    fuchsia: "from-fuchsia-500 to-fuchsia-600",
    amber: "from-amber-500 to-amber-600",
  } as const;
  return (
    <div className="flex items-center gap-3 pt-2">
      <div
        className={`h-9 w-9 rounded-xl bg-gradient-to-br ${map[color]} text-white flex items-center justify-center shadow-md`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <h2 className="text-lg font-extrabold text-slate-800">{children}</h2>
      <div className="flex-1 h-px bg-gradient-to-l from-slate-200 to-transparent" />
    </div>
  );
}

function Field({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-rose-500" />}
        {label}
      </Label>
      {children}
    </div>
  );
}