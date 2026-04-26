import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, LogOut, RefreshCw, Sparkles, HeartHandshake, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pending")({
  component: PendingPage,
});

function PendingPage() {
  const { user, approved, loading, signOut, refreshAccess } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState<string>("pending");

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
    if (!loading && user && approved) nav({ to: "/admin" });
  }, [user, approved, loading, nav]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("membership_requests")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => data?.status && setStatus(data.status));
  }, [user]);

  const recheck = async () => {
    await refreshAccess();
    if (user) {
      const { data } = await supabase
        .from("membership_requests")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.status) setStatus(data.status);
    }
  };

  const isRejected = status === "rejected";

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-hero p-4 sm:p-6 relative overflow-hidden"
      dir="rtl"
    >
      {/* خلفية زخرفية ناعمة */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <Card className="relative max-w-xl w-full p-0 overflow-hidden shadow-elegant border-gold/20">
        {/* شريط علوي ذهبي */}
        <div className="h-1.5 w-full bg-gradient-to-l from-gold via-primary to-gold" />

        <div className="p-6 sm:p-8 space-y-6 text-center">
          {/* الشعار */}
          <div className="flex justify-center">
            <Logo size={56} />
          </div>

          {/* أيقونة الحالة */}
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-gold/10 animate-ping" />
            <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-gold/25 to-gold/10 border border-gold/30 flex items-center justify-center shadow-soft">
              <Clock className="h-11 w-11 text-gold" />
            </div>
          </div>

          {/* العنوان */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {isRejected ? "تم رفض طلبك" : "حسابك قيد المراجعة"}
            </h1>
            <div className="mx-auto h-px w-16 bg-gradient-to-l from-transparent via-gold/60 to-transparent" />
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
              {isRejected
                ? "نأسف، تم رفض طلب انضمامك من قِبَل الإدارة العليا. يمكنك التواصل معهم للاستفسار."
                : "تم استلام طلبك وسيقوم مسؤول الإدارة العليا بمراجعته وتسكينك في اللجنة المناسبة. سنُعلمك فور الاعتماد."}
            </p>
          </div>

          {/* الحديث الشريف */}
          <div className="relative rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-gold/5 to-transparent p-6 text-right overflow-hidden">
            <div className="absolute top-3 left-3 opacity-10">
              <BookOpen className="h-16 w-16 text-gold" />
            </div>
            <div className="relative space-y-4">
              <div className="flex items-center gap-2 text-gold">
                <div className="h-8 w-8 rounded-full bg-gold/15 flex items-center justify-center">
                  <HeartHandshake className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold tracking-widest uppercase">حديث شريف</span>
              </div>

              <blockquote className="relative">
                <span className="absolute -top-2 right-0 text-4xl text-gold/40 font-serif leading-none">”</span>
                <p className="px-6 text-base sm:text-lg leading-loose font-semibold text-foreground">
                  عَنْ جَابِرٍ رَضِيَ اللَّهُ عَنْهُ، أَنَّ النَّبِيَّ ﷺ قَالَ:
                  <br />
                  <span className="text-primary">
                    «خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ»
                  </span>
                </p>
                <span className="absolute -bottom-6 left-0 text-4xl text-gold/40 font-serif leading-none">“</span>
              </blockquote>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gold/20">
                <span className="text-[11px] text-muted-foreground">
                  رواه الطبراني في المعجم الأوسط · وحسّنه الألباني في صحيح الجامع
                </span>
              </div>
            </div>
          </div>

          {/* استحضار النية */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-gold/5 to-transparent p-6 text-right space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold tracking-widest uppercase">استحضر النيّة</span>
            </div>
            <p className="text-sm sm:text-[15px] leading-loose text-foreground/90">
              اجعل عملك خالصاً لوجه الله، فما تبذله من جهدٍ لخدمة أهلك وأبناء عائلتك
              <span className="text-primary font-semibold"> صدقةٌ جاريةٌ </span>
              وأثرٌ باقٍ. النيّة الصادقة تُحوِّل العادة إلى عبادة، وتجعل من كل لحظةٍ تُقدّمها
              <span className="text-gold font-semibold"> قربةً تُرفع بها درجاتك</span>.
            </p>
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              onClick={recheck}
              className="gap-2 bg-gradient-to-l from-primary to-gold text-primary-foreground shadow-soft hover:shadow-elegant transition-all"
            >
              <RefreshCw className="h-4 w-4" /> تحديث الحالة
            </Button>
            <Button onClick={() => signOut()} variant="ghost" className="gap-2">
              <LogOut className="h-4 w-4" /> تسجيل خروج
            </Button>
          </div>
        </div>

        {/* شريط سفلي */}
        <div className="h-1 w-full bg-gradient-to-l from-gold/40 via-primary/40 to-gold/40" />
      </Card>
    </div>
  );
}
