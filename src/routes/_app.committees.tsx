import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Users2, ListTodo } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/committees")({
  component: CommitteesPage,
});

interface Committee {
  id: string;
  name: string;
  type: string;
  description: string | null;
  budget_allocated: number;
  budget_spent: number;
}

interface Task {
  id: string;
  committee_id: string;
  title: string;
  status: "todo" | "in_progress" | "completed";
  priority: string;
}

const TYPE_LABELS: Record<string, string> = {
  finance: "مالية",
  media: "إعلام",
  quality: "جودة",
  programs: "برامج",
  dinner: "عشاء",
  logistics: "تجهيزات",
  reception: "استقبال",
  design: "تصميم",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "قائمة الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
};

function CommitteesPage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState<Task["status"]>("todo");

  const load = async () => {
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from("committees").select("*").order("name"),
      supabase.from("committee_tasks").select("id, committee_id, title, status, priority"),
    ]);
    setCommittees(c ?? []);
    setTasks((t ?? []) as Task[]);
    if (c && c.length && !activeId) setActiveId(c[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const fmt = (n: number) => new Intl.NumberFormat("ar-SA").format(n);
  const active = committees.find((c) => c.id === activeId);
  const activeTasks = tasks.filter((t) => t.committee_id === activeId);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId) return;
    const { error } = await supabase.from("committee_tasks").insert({
      committee_id: activeId,
      title,
      description: desc,
      status,
    });
    if (error) {
      toast.error("تعذرت الإضافة", { description: error.message });
      return;
    }
    toast.success("تمت إضافة المهمة");
    setTitle("");
    setDesc("");
    setOpen(false);
    load();
  };

  const moveTask = async (id: string, to: Task["status"]) => {
    await supabase.from("committee_tasks").update({ status: to }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">اللجان والمهام</h1>
        <p className="text-muted-foreground mt-1">بوابة كل لجنة لمتابعة مهامها وميزانيتها</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Committees list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Users2 className="h-4 w-4" /> اللجان ({committees.length})
          </div>
          {committees.map((c) => {
            const active = c.id === activeId;
            const taskCount = tasks.filter((t) => t.committee_id === c.id).length;
            return (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-right rounded-xl p-4 border transition-all ${
                  active
                    ? "bg-gradient-hero text-primary-foreground border-transparent shadow-elegant"
                    : "bg-card hover:border-primary/40 hover:shadow-soft"
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold">{c.name}</span>
                  <Badge
                    variant="outline"
                    className={active ? "bg-gold/20 text-gold-foreground border-gold/40" : ""}
                  >
                    {TYPE_LABELS[c.type] ?? c.type}
                  </Badge>
                </div>
                <p className={`text-xs ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {taskCount} مهمة • {fmt(Number(c.budget_allocated))} ر.س
                </p>
              </button>
            );
          })}
        </div>

        {/* Active committee detail */}
        <div className="space-y-5">
          {active && (
            <>
              <div className="rounded-2xl border bg-gradient-card p-6 shadow-soft">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{active.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{active.description ?? "—"}</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="rounded-lg bg-primary/10 px-4 py-2">
                      <p className="text-xs text-muted-foreground">مخصص</p>
                      <p className="font-bold text-primary">{fmt(Number(active.budget_allocated))} ر.س</p>
                    </div>
                    <div className="rounded-lg bg-gold/10 px-4 py-2">
                      <p className="text-xs text-muted-foreground">منصرف</p>
                      <p className="font-bold text-gold-foreground">{fmt(Number(active.budget_spent))} ر.س</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kanban */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-primary" /> لوحة المهام
                </h3>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-gradient-gold text-gold-foreground shadow-gold">
                      <Plus className="h-4 w-4 ms-1" /> مهمة جديدة
                    </Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>إضافة مهمة</DialogTitle></DialogHeader>
                    <form onSubmit={addTask} className="space-y-3 pt-2">
                      <div className="space-y-2"><Label>العنوان</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
                      <div className="space-y-2"><Label>الوصف</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
                      <div className="space-y-2">
                        <Label>الحالة</Label>
                        <Select value={status} onValueChange={(v) => setStatus(v as Task["status"])}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">قائمة الانتظار</SelectItem>
                            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                            <SelectItem value="completed">مكتملة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full bg-gradient-hero text-primary-foreground">حفظ</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["todo", "in_progress", "completed"] as const).map((col) => (
                  <div key={col} className="rounded-2xl border bg-muted/30 p-4 min-h-[280px]">
                    <h4 className="text-sm font-bold mb-3 flex items-center justify-between">
                      <span>{STATUS_LABELS[col]}</span>
                      <span className="text-xs text-muted-foreground">
                        {activeTasks.filter((t) => t.status === col).length}
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {activeTasks
                        .filter((t) => t.status === col)
                        .map((t) => (
                          <div
                            key={t.id}
                            className="rounded-lg bg-card p-3 shadow-soft border hover:border-primary/40 transition"
                          >
                            <p className="font-medium text-sm mb-2">{t.title}</p>
                            <div className="flex gap-1">
                              {(["todo", "in_progress", "completed"] as const)
                                .filter((s) => s !== t.status)
                                .map((s) => (
                                  <button
                                    key={s}
                                    onClick={() => moveTask(t.id, s)}
                                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition"
                                  >
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                            </div>
                          </div>
                        ))}
                      {activeTasks.filter((t) => t.status === col).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-6">لا توجد مهام</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
