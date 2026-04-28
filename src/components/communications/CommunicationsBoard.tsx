import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy, Newspaper, HelpCircle, Megaphone, Plus, Trash2, Send, MessageCircle,
  Building2, Globe2, Users2, Loader2, Eye, Info,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

type PostType = "achievement" | "news" | "inquiry" | "internal_announcement";
type PostScope = "committee" | "targeted" | "all";

interface Post {
  id: string;
  author_id: string;
  author_name: string;
  source_committee_id: string;
  target_committee_id: string | null;
  scope: PostScope;
  post_type: PostType;
  title: string;
  body: string;
  created_at: string;
}

interface Committee { id: string; name: string; type: string; }
interface Comment { id: string; post_id: string; user_id: string; author_name: string; body: string; created_at: string; }

const TYPE_META: Record<PostType, { label: string; icon: any; color: string }> = {
  achievement: { label: "منجز", icon: Trophy, color: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
  news: { label: "خبر", icon: Newspaper, color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  inquiry: { label: "استفسار", icon: HelpCircle, color: "bg-amber-500/10 text-amber-700 border-amber-300" },
  internal_announcement: { label: "إعلان داخلي", icon: Megaphone, color: "bg-purple-500/10 text-purple-700 border-purple-300" },
};

const SCOPE_META: Record<PostScope, { label: string; icon: any }> = {
  committee: { label: "داخل اللجنة", icon: Users2 },
  targeted: { label: "إلى لجنة محددة", icon: Building2 },
  all: { label: "لكل اللجان", icon: Globe2 },
};

export function CommunicationsBoard() {
  const { user, committeeId, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [posts, setPosts] = useState<Post[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PostType | "all">("all");
  const [openNew, setOpenNew] = useState(false);

  const [fType, setFType] = useState<PostType>("news");
  const [fScope, setFScope] = useState<PostScope>("committee");
  const [fTarget, setFTarget] = useState<string>("");
  const [fSource, setFSource] = useState<string>("");
  const [fTitle, setFTitle] = useState("");
  const [fBody, setFBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setAuthorName(data?.full_name ?? user.email ?? "عضو"));
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("committee_posts").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("committees").select("id,name,type").order("name"),
    ]);
    setPosts((p ?? []) as Post[]);
    setCommittees((c ?? []) as Committee[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("posts-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "committee_posts" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(
    () => filter === "all" ? posts : posts.filter(p => p.post_type === filter),
    [filter, posts]
  );

  const submit = async () => {
    if (!user) return;
    const sourceId = committeeId || (isAdmin ? fSource : "");
    if (!sourceId) {
      return toast.error(
        isAdmin
          ? "اختر اللجنة التي ستنشر باسمها"
          : "يجب أن تكون عضواً في لجنة لتنشر منشور",
      );
    }
    if (!fTitle.trim() || !fBody.trim()) return toast.error("العنوان والنص مطلوبان");
    if (fScope === "targeted" && !fTarget) return toast.error("اختر اللجنة المستهدفة");
    setSubmitting(true);
    const { error } = await supabase.from("committee_posts").insert({
      author_id: user.id,
      author_name: authorName || "عضو",
      source_committee_id: sourceId,
      target_committee_id: fScope === "targeted" ? fTarget : null,
      scope: fScope,
      post_type: fType,
      title: fTitle.trim(),
      body: fBody.trim(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("تم نشر المنشور وإرسال الإشعارات");
    setOpenNew(false);
    setFTitle(""); setFBody(""); setFTarget(""); setFSource("");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-gradient-to-l from-primary/5 via-background to-background p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div>
              <h2 className="text-2xl font-bold">مركز التواصل</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              قناة رسمية موحّدة بين اللجان لمشاركة <strong className="text-foreground">المنجزات</strong>،
              نشر <strong className="text-foreground">الأخبار</strong>، توجيه <strong className="text-foreground">الاستفسارات</strong>،
              وإصدار <strong className="text-foreground">الإعلانات الداخلية</strong> — مع تنبيهات تلقائية للأعضاء المعنيين
              حسب نطاق المنشور (داخل اللجنة · لجنة محددة · جميع اللجان).
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              يحلّ هذا المركز محل المحادثات الجانبية ويوثّق التواصل الرسمي بين اللجان.
            </div>
          </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2 shadow-md"><Plus className="h-4 w-4" /> منشور جديد</Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>إنشاء منشور جديد</DialogTitle></DialogHeader>
            <div className="grid md:grid-cols-2 gap-5 py-2">
              <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold mb-1 block">نوع المنشور</label>
                  <Select value={fType} onValueChange={(v) => setFType(v as PostType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_META) as PostType[]).map(k => (
                        <SelectItem key={k} value={k}>{TYPE_META[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-bold mb-1 block">النطاق</label>
                  <Select value={fScope} onValueChange={(v) => setFScope(v as PostScope)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SCOPE_META) as PostScope[]).map(k => (
                        <SelectItem key={k} value={k}>{SCOPE_META[k].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {fScope === "targeted" && (
                <div>
                  <label className="text-sm font-bold mb-1 block">اللجنة المستهدفة</label>
                  <Select value={fTarget} onValueChange={setFTarget}>
                    <SelectTrigger><SelectValue placeholder="اختر اللجنة" /></SelectTrigger>
                    <SelectContent>
                      {committees.filter(c => c.id !== (committeeId || fSource)).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!committeeId && isAdmin && (
                <div>
                  <label className="text-sm font-bold mb-1 block">النشر باسم لجنة</label>
                  <Select value={fSource} onValueChange={setFSource}>
                    <SelectTrigger><SelectValue placeholder="اختر اللجنة المصدر" /></SelectTrigger>
                    <SelectContent>
                      {committees.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    أنت مدير غير مرتبط بلجنة محددة — اختر اللجنة التي سيظهر المنشور باسمها.
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-bold mb-1 block">العنوان</label>
                <Input value={fTitle} onChange={(e) => setFTitle(e.target.value)} maxLength={200} placeholder="عنوان مختصر..." />
                <p className="text-[11px] text-muted-foreground mt-1 text-left ltr">{fTitle.length}/200</p>
              </div>
              <div>
                <label className="text-sm font-bold mb-1 block">المحتوى</label>
                <Textarea value={fBody} onChange={(e) => setFBody(e.target.value)} rows={8} maxLength={4000} placeholder="اكتب التفاصيل هنا..." />
                <p className="text-[11px] text-muted-foreground mt-1 text-left ltr">{fBody.length}/4000</p>
              </div>
              </div>

              {/* Live preview panel */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                  <Eye className="h-4 w-4" /> معاينة فورية
                </div>
                <PostPreview
                  type={fType}
                  scope={fScope}
                  title={fTitle}
                  body={fBody}
                  authorName={authorName}
                  sourceName={committees.find(c => c.id === (committeeId || fSource))?.name}
                  targetName={fScope === "targeted" ? committees.find(c => c.id === fTarget)?.name : undefined}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenNew(false)}>إلغاء</Button>
              <Button onClick={submit} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                نشر
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <div className="w-full overflow-x-auto -mx-2 px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex w-max min-w-full sm:grid sm:grid-cols-5 sm:w-full sm:max-w-2xl">
            <TabsTrigger value="all" className="whitespace-nowrap shrink-0">الكل</TabsTrigger>
            {(Object.keys(TYPE_META) as PostType[]).map(k => (
              <TabsTrigger key={k} value={k} className="whitespace-nowrap shrink-0">{TYPE_META[k].label}</TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">لا توجد منشورات بعد.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <PostCard key={p.id} post={p} committees={committees} currentUserId={user?.id ?? ""} authorName={authorName} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostPreview({
  type, scope, title, body, authorName, sourceName, targetName,
}: {
  type: PostType; scope: PostScope;
  title: string; body: string; authorName: string;
  sourceName?: string; targetName?: string;
}) {
  const meta = TYPE_META[type];
  const scopeMeta = SCOPE_META[scope];
  const Icon = meta.icon;
  const ScopeIcon = scopeMeta.icon;
  const hasContent = title.trim() || body.trim();

  return (
    <div className="border rounded-xl p-4 bg-muted/30 sticky top-2">
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2 rounded-lg border ${meta.color} shrink-0`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <ScopeIcon className="h-3 w-3" />
              {scopeMeta.label}{targetName ? ` → ${targetName}` : ""}
            </Badge>
          </div>
          <h3 className="font-bold text-base break-words">
            {title.trim() || <span className="text-muted-foreground font-normal">عنوان المنشور...</span>}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {authorName || "—"} · {sourceName || <span className="text-amber-600">لم تُحدَّد لجنة المصدر</span>} · الآن
          </p>
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap text-foreground/90 min-h-[3rem]">
        {body.trim() || <span className="text-muted-foreground">سيظهر محتوى المنشور هنا أثناء الكتابة...</span>}
      </p>
      {!hasContent && (
        <div className="mt-3 text-[11px] text-muted-foreground border-t pt-2 flex items-center gap-1.5">
          <Info className="h-3 w-3" /> هذه معاينة فورية — لن يتم النشر حتى تضغط "نشر".
        </div>
      )}
    </div>
  );
}

function PostCard({ post, committees, currentUserId, authorName, onDeleted }: {
  post: Post; committees: Committee[]; currentUserId: string; authorName: string; onDeleted: () => void;
}) {
  const meta = TYPE_META[post.post_type];
  const scopeMeta = SCOPE_META[post.scope];
  const Icon = meta.icon;
  const ScopeIcon = scopeMeta.icon;
  const srcName = committees.find(c => c.id === post.source_committee_id)?.name;
  const tgtName = post.target_committee_id ? committees.find(c => c.id === post.target_committee_id)?.name : null;
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingC, setLoadingC] = useState(false);

  const loadComments = async () => {
    setLoadingC(true);
    const { data } = await supabase.from("committee_post_comments")
      .select("*").eq("post_id", post.id).order("created_at", { ascending: true });
    setComments((data ?? []) as Comment[]);
    setLoadingC(false);
  };

  useEffect(() => { if (showComments) loadComments(); }, [showComments]);

  const submitComment = async () => {
    if (!newComment.trim()) return;
    const { error } = await supabase.from("committee_post_comments").insert({
      post_id: post.id, user_id: currentUserId, author_name: authorName || "عضو", body: newComment.trim(),
    });
    if (error) return toast.error(error.message);
    setNewComment("");
    loadComments();
  };

  const del = async () => {
    if (!confirm("حذف المنشور نهائياً؟")) return;
    const { error } = await supabase.from("committee_posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف");
    onDeleted();
  };

  const canDelete = post.author_id === currentUserId;
  const timeAgo = (() => {
    try { return formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ar }); }
    catch { return ""; }
  })();

  return (
    <div className="border rounded-xl p-4 bg-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`p-2 rounded-lg border ${meta.color} shrink-0`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
              <Badge variant="secondary" className="gap-1">
                <ScopeIcon className="h-3 w-3" />
                {scopeMeta.label}{tgtName ? ` → ${tgtName}` : ""}
              </Badge>
            </div>
            <h3 className="font-bold text-lg truncate">{post.title}</h3>
            <p className="text-xs text-muted-foreground">
              {post.author_name} · {srcName} · {timeAgo}
            </p>
          </div>
        </div>
        {canDelete && (
          <Button size="icon" variant="ghost" onClick={del} className="text-destructive shrink-0">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap text-foreground/90 mb-3">{post.body}</p>
      <Button variant="ghost" size="sm" onClick={() => setShowComments(s => !s)} className="gap-2">
        <MessageCircle className="h-4 w-4" />
        {showComments ? "إخفاء التعليقات" : "التعليقات والردود"}
      </Button>
      {showComments && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {loadingC ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center">لا توجد تعليقات بعد.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="text-sm bg-muted/40 rounded-lg p-2">
                <p className="font-bold text-xs">{c.author_name}</p>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            ))
          )}
          <div className="flex gap-2">
            <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="اكتب رداً..."
              onKeyDown={(e) => { if (e.key === "Enter") submitComment(); }} />
            <Button size="sm" onClick={submitComment} className="gap-1"><Send className="h-3 w-3" /> إرسال</Button>
          </div>
        </div>
      )}
    </div>
  );
}
