import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Lightbulb,
  Plus,
  ThumbsUp,
  Trash2,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Clock,
  Archive,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ideas")({
  component: IdeasBank,
});

type IdeaStatus = "new" | "under_review" | "approved" | "implemented" | "archived";

interface Idea {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string | null;
  status: IdeaStatus;
  admin_response: string | null;
  reviewed_at: string | null;
  votes_count: number;
  created_at: string;
  author_name?: string;
  user_voted?: boolean;
}

const STATUS_META: Record<IdeaStatus, { label: string; tone: string; icon: typeof Clock }> = {
  new: { label: "جديدة", tone: "bg-sky-500/15 text-sky-700 dark:text-sky-300", icon: Sparkles },
  under_review: { label: "قيد الدراسة", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300", icon: Clock },
  approved: { label: "معتمدة", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
  implemented: { label: "نُفذت", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300", icon: CheckCircle2 },
  archived: { label: "مؤرشفة", tone: "bg-muted text-muted-foreground", icon: Archive },
};

const CATEGORIES = [
  "تطوير الفعاليات",
  "تحسين العمليات",
  "تجربة الضيوف",
  "الإعلام والتسويق",
  "الجوانب المالية",
  "اللوجستيات والتجهيزات",
  "أخرى",
];

function IdeasBank() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | IdeaStatus>("all");
  const [openNew, setOpenNew] = useState(false);
  const [busy, setBusy] = useState(false);

  // form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");

  // admin response state
  const [respondingTo, setRespondingTo] = useState<Idea | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responseStatus, setResponseStatus] = useState<IdeaStatus>("under_review");

  const fetchIdeas = async () => {
    setLoading(true);
    const { data: ideasData } = await supabase
      .from("ideas")
      .select("*")
      .order("votes_count", { ascending: false })
      .order("created_at", { ascending: false });

    if (!ideasData) {
      setIdeas([]);
      setLoading(false);
      return;
    }

    const userIds = Array.from(new Set(ideasData.map((i) => i.user_id)));
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) ?? []);

    let myVotes: Set<string> = new Set();
    if (user) {
      const { data: votes } = await supabase
        .from("idea_votes")
        .select("idea_id")
        .eq("user_id", user.id);
      myVotes = new Set(votes?.map((v) => v.idea_id) ?? []);
    }

    setIdeas(
      ideasData.map((i) => ({
        ...i,
        author_name: nameMap.get(i.user_id) ?? "عضو",
        user_voted: myVotes.has(i.id),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchIdeas();
    const channel = supabase
      .channel("ideas_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ideas" }, () => fetchIdeas())
      .on("postgres_changes", { event: "*", schema: "public", table: "idea_votes" }, () => fetchIdeas())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const submitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !description.trim()) {
      toast.error("الرجاء إكمال الحقول المطلوبة");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("ideas").insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category: category || null,
    });
    setBusy(false);
    if (error) {
      toast.error("تعذّر إرسال الفكرة", { description: error.message });
      return;
    }
    toast.success("تم إرسال فكرتك", { description: "ستراجعها الإدارة العليا قريباً" });
    setTitle("");
    setDescription("");
    setCategory("");
    setOpenNew(false);
  };

  const toggleVote = async (idea: Idea) => {
    if (!user) return;
    if (idea.user_voted) {
      await supabase.from("idea_votes").delete().eq("idea_id", idea.id).eq("user_id", user.id);
    } else {
      const { error } = await supabase.from("idea_votes").insert({ idea_id: idea.id, user_id: user.id });
      if (error && !error.message.includes("duplicate")) {
        toast.error("تعذّر التصويت");
        return;
      }
    }
  };

  const deleteIdea = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الفكرة؟")) return;
    const { error } = await supabase.from("ideas").delete().eq("id", id);
    if (error) toast.error("تعذّر الحذف");
    else toast.success("تم الحذف");
  };

  const submitResponse = async () => {
    if (!respondingTo || !user) return;
    const { error } = await supabase
      .from("ideas")
      .update({
        admin_response: responseText || null,
        status: responseStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", respondingTo.id);
    if (error) {
      toast.error("تعذّر حفظ الرد");
      return;
    }
    toast.success("تم تحديث الفكرة");
    setRespondingTo(null);
    setResponseText("");
  };

  const filtered = filter === "all" ? ideas : ideas.filter((i) => i.status === filter);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
        <div className="absolute -top-10 -left-10 w-72 h-72 bg-gold/20 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gold/20 flex items-center justify-center backdrop-blur-sm shrink-0">
            <Lightbulb className="h-7 w-7 text-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-primary-foreground/70">مساحة الإبداع المشترك</p>
            <h1 className="text-2xl lg:text-3xl font-bold">
              <span className="text-shimmer-gold">بنك الأفكار</span>
            </h1>
            <p className="text-primary-foreground/80 text-sm mt-1">
              شاركنا فكرتك لتطوير البرنامج، فأبواب الإبداع مفتوحة لكل عضو، وكل اقتراحٍ قيّمٍ يصلُ إلى الإدارة العليا
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            الكل ({ideas.length})
          </Button>
          {(Object.keys(STATUS_META) as IdeaStatus[]).map((s) => {
            const count = ideas.filter((i) => i.status === s).length;
            return (
              <Button
                key={s}
                size="sm"
                variant={filter === s ? "default" : "outline"}
                onClick={() => setFilter(s)}
              >
                {STATUS_META[s].label} ({count})
              </Button>
            );
          })}
        </div>

        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-l from-primary to-gold text-primary-foreground">
              <Plus className="h-4 w-4" /> اقترح فكرة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-lg">
            <DialogHeader>
              <DialogTitle>شاركنا فكرتك</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitIdea} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">عنوان الفكرة *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="عنوان قصير ومعبّر"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat">التصنيف</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="cat">
                    <SelectValue placeholder="اختر تصنيفاً (اختياري)" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">شرح الفكرة *</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="اشرح فكرتك بالتفصيل، وما الفائدة المرجوّة منها"
                  rows={5}
                  maxLength={2000}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={busy} className="gap-2">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  إرسال الفكرة
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Ideas list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-40" />
          لا توجد أفكار في هذه الفئة بعد. كن أوّل من يشاركنا!
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((idea) => {
            const meta = STATUS_META[idea.status];
            const StatusIcon = meta.icon;
            const canDelete = isAdmin || idea.user_id === user?.id;
            return (
              <Card key={idea.id} className="p-5 hover:shadow-elegant transition-shadow">
                <div className="flex items-start gap-4">
                  {/* Vote button */}
                  <button
                    onClick={() => toggleVote(idea)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all shrink-0 ${
                      idea.user_voted
                        ? "bg-gradient-gold text-gold-foreground shadow-gold"
                        : "bg-muted hover:bg-accent"
                    }`}
                  >
                    <ThumbsUp className="h-5 w-5" />
                    <span className="text-sm font-bold">{idea.votes_count}</span>
                  </button>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <h3 className="font-bold text-base">{idea.title}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{idea.author_name}</span>
                          <span>·</span>
                          <span>{new Date(idea.created_at).toLocaleDateString("ar-SA")}</span>
                          {idea.category && (
                            <>
                              <span>·</span>
                              <Badge variant="outline" className="text-[10px]">
                                {idea.category}
                              </Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge className={`gap-1 ${meta.tone}`} variant="secondary">
                        <StatusIcon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>

                    <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
                      {idea.description}
                    </p>

                    {idea.admin_response && (
                      <div className="mt-3 rounded-xl border border-gold/30 bg-gold/5 p-3 space-y-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gold">
                          <MessageSquare className="h-3.5 w-3.5" />
                          ردّ الإدارة العليا
                        </div>
                        <p className="text-sm text-foreground/85 whitespace-pre-wrap">
                          {idea.admin_response}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => {
                            setRespondingTo(idea);
                            setResponseText(idea.admin_response ?? "");
                            setResponseStatus(idea.status);
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          مراجعة والرد
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => deleteIdea(idea.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          حذف
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Admin response dialog */}
      <Dialog open={!!respondingTo} onOpenChange={(o) => !o && setRespondingTo(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>مراجعة الفكرة والرد عليها</DialogTitle>
          </DialogHeader>
          {respondingTo && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="font-semibold text-sm">{respondingTo.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{respondingTo.description}</p>
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select value={responseStatus} onValueChange={(v) => setResponseStatus(v as IdeaStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_META) as IdeaStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ردّ الإدارة (اختياري)</Label>
                <Textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  placeholder="اكتب رد الإدارة على هذه الفكرة"
                  maxLength={1500}
                />
              </div>
              <DialogFooter>
                <Button onClick={submitResponse}>حفظ</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
