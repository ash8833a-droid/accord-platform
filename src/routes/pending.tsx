import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, LogOut, RefreshCw, Sparkles, HeartHandshake } from "lucide-react";
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
    if (!loading && user && approved) nav({ to: "/dashboard" });
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-hero p-6" dir="rtl">
      <Card className="max-w-lg w-full p-8 space-y-6 text-center">
        <div className="flex justify-center"><Logo size={56} /></div>
        <div className="mx-auto h-20 w-20 rounded-full bg-gold/15 flex items-center justify-center">
          <Clock className="h-10 w-10 text-gold animate-pulse" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">
            {status === "rejected" ? "تم رفض طلبك" : "حسابك قيد المراجعة"}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {status === "rejected"
              ? "نأسف، تم رفض طلب انضمامك من قِبَل الإدارة العليا. يمكنك التواصل معهم للاستفسار."
              : "تم استلام طلبك وسيقوم مسؤول الإدارة العليا بمراجعته وتسكينك في اللجنة المناسبة. سنُعلمك فور الاعتماد."}
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={recheck} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> تحديث الحالة
          </Button>
          <Button onClick={() => signOut()} variant="ghost" className="gap-2">
            <LogOut className="h-4 w-4" /> تسجيل خروج
          </Button>
        </div>
      </Card>
    </div>
  );
}
