import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import { Loader2, Banknote, Lock, Home } from "lucide-react";
import { PageHeroHeader } from "@/components/PageHeroHeader";
import { PageGate } from "@/components/PageGate";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const FinanceModule = lazy(() =>
  import("@/components/FinanceModule").then((m) => ({ default: m.FinanceModule }))
);

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-muted-foreground" dir="rtl">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm">جارٍ تحميل إدارة المالية…</p>
    </div>
  );
}

function NoAccess() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6" dir="rtl">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold">صفحة خاصة باللجنة المالية</h2>
          <p className="text-sm text-muted-foreground">
            هذه الصفحة متاحة لأعضاء اللجنة المالية والإدارة العليا والجودة فقط.
          </p>
          <Link to="/">
            <Button variant="outline" className="gap-2">
              <Home className="h-4 w-4" /> العودة للرئيسية
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceManagementInner() {
  const { user, hasRole, committeeId } = useAuth();
  const [committeeType, setCommitteeType] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!committeeId) {
      setCommitteeType(null);
      setChecked(true);
      return;
    }
    supabase
      .from("committees")
      .select("type")
      .eq("id", committeeId)
      .maybeSingle()
      .then(({ data }) => {
        setCommitteeType(data?.type ?? null);
        setChecked(true);
      });
  }, [committeeId]);

  if (!user || !checked) return <PageFallback />;

  const allowed =
    hasRole("admin") ||
    hasRole("quality") ||
    committeeType === "finance" ||
    committeeType === "supreme";

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeroHeader
        eyebrow="اللجنة المالية"
        highlight="إدارة"
        title="المالية"
        subtitle="المحفظة، المناديب، الاشتراكات، وطلبات الصرف الواردة"
        icon={Banknote}
      />
      {allowed ? (
        <Suspense fallback={<PageFallback />}>
          <FinanceModule />
        </Suspense>
      ) : (
        <NoAccess />
      )}
    </div>
  );
}

function FinanceManagementPage() {
  return (
    <PageGate pageKey="finance-management">
      <FinanceManagementInner />
    </PageGate>
  );
}

export const Route = createFileRoute("/_app/finance-management")({
  pendingComponent: PageFallback,
  pendingMs: 0,
  component: FinanceManagementPage,
});