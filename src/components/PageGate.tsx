import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { usePageAccess } from "@/hooks/use-page-access";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, EyeOff, Home } from "lucide-react";

interface Props {
  pageKey: string;
  children: ReactNode | ((ctx: { canEdit: boolean; canRead: boolean }) => ReactNode);
}

// Wraps a page and enforces page-level access. Falls back to a friendly screen.
export function PageGate({ pageKey, children }: Props) {
  const { level, loading, canRead, canEdit, isHidden } = usePageAccess(pageKey);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">جاري التحقق من الصلاحيات...</div>;
  }
  if (isHidden) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <EyeOff className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">لا تملك صلاحية الوصول</h2>
            <p className="text-sm text-muted-foreground">هذه الصفحة غير متاحة لحسابك. تواصل مع المدير لطلب الوصول.</p>
            <Link to="/"><Button variant="outline" className="gap-2"><Home className="h-4 w-4" />العودة للرئيسية</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (typeof children === "function") {
    return <>{children({ canEdit, canRead })}</>;
  }
  return (
    <>
      {!canEdit && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <Lock className="h-3.5 w-3.5" />
          وضع القراءة فقط — لا يمكنك التعديل أو الإضافة على هذه الصفحة.
        </div>
      )}
      <fieldset disabled={!canEdit} className={!canEdit ? "[&_button]:pointer-events-auto" : ""}>
        {children}
      </fieldset>
    </>
  );
}
