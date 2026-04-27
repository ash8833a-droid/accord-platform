import { createFileRoute } from "@tanstack/react-router";
import { ProcurementRequestsBoard } from "@/components/procurement/ProcurementRequestsBoard";

export const Route = createFileRoute("/_app/procurement-requests")({
  head: () => ({
    meta: [
      { title: "طلبات الشراء بين اللجان" },
      {
        name: "description",
        content:
          "تقديم ومتابعة طلبات الشراء الموحّدة بين لجان الزواج الجماعي ولجنة المشتريات.",
      },
    ],
  }),
  component: ProcurementRequestsPage,
});

function ProcurementRequestsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">طلبات الشراء بين اللجان</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ارفع طلب شراء موحّد إلى لجنة المشتريات وتابع حالته حتى التسليم.
        </p>
      </div>
      <ProcurementRequestsBoard />
    </div>
  );
}