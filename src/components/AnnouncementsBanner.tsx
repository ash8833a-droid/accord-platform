import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CalendarClock, ChevronRight, ChevronLeft, X, Megaphone } from "lucide-react";

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_pinned: boolean;
}

interface MeetingInfo {
  date: string;
  time: string;
  location: string;
  agenda: string;
}

interface NormalizedItem {
  id: string;
  kind: "meeting" | "news";
  title: string;
  body: string;
  createdAt: string;
  pinned: boolean;
  meetingAt?: number; // ms epoch
  meetingInfo?: MeetingInfo;
}

const DISMISS_KEY = "announcements_dismissed_v1";

const parseMeeting = (b: string): MeetingInfo => {
  try {
    return JSON.parse(b) as MeetingInfo;
  } catch {
    return { date: "", time: "", location: "", agenda: b };
  }
};

const meetingTimestamp = (info: MeetingInfo): number | undefined => {
  if (!info.date) return undefined;
  const t = info.time && /^\d{2}:\d{2}/.test(info.time) ? info.time : "00:00";
  const ms = new Date(`${info.date}T${t}:00`).getTime();
  return Number.isFinite(ms) ? ms : undefined;
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Countdown({ target }: { target: number }) {
  const now = useNow(1000);
  const diff = target - now;
  if (diff <= 0) {
    return <span className="font-bold text-emerald-300">بدأ الاجتماع الآن</span>;
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return (
    <span className="font-bold tabular-nums tracking-tight">
      {days > 0 && <>{days} يوم </>}
      {hours.toString().padStart(2, "0")}:{minutes.toString().padStart(2, "0")}:
      {seconds.toString().padStart(2, "0")}
    </span>
  );
}

export function AnnouncementsBanner() {
  const [items, setItems] = useState<NormalizedItem[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null;
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [index, setIndex] = useState(0);

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, created_at, is_pinned")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = (data as AnnouncementRow[]) ?? [];
    const normalized: NormalizedItem[] = rows.map((r) => {
      const isMeeting = r.title.startsWith("[MEETING]");
      if (isMeeting) {
        const info = parseMeeting(r.body);
        return {
          id: r.id,
          kind: "meeting",
          title: r.title.replace(/^\[MEETING\]\s*/, ""),
          body: r.body,
          createdAt: r.created_at,
          pinned: r.is_pinned,
          meetingAt: meetingTimestamp(info),
          meetingInfo: info,
        };
      }
      return {
        id: r.id,
        kind: "news",
        title: r.title,
        body: r.body,
        createdAt: r.created_at,
        pinned: r.is_pinned,
      };
    });
    // Hide past meetings (after end + 2h grace)
    const filtered = normalized.filter((it) => {
      if (it.kind !== "meeting") return true;
      if (!it.meetingAt) return true;
      return it.meetingAt + 2 * 60 * 60 * 1000 > Date.now();
    });
    setItems(filtered);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("announcements_banner")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const visible = useMemo(
    () => items.filter((it) => !dismissed.includes(it.id)),
    [items, dismissed],
  );

  useEffect(() => {
    if (index >= visible.length) setIndex(0);
  }, [visible.length, index]);

  if (visible.length === 0) return null;

  const current = visible[index];
  const isMeeting = current.kind === "meeting";

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-200)));
    } catch {
      /* ignore */
    }
  };

  const next = () => setIndex((i) => (i + 1) % visible.length);
  const prev = () => setIndex((i) => (i - 1 + visible.length) % visible.length);

  return (
    <div
      className={`relative overflow-hidden border-b ${
        isMeeting
          ? "bg-gradient-to-l from-primary via-primary to-gold text-primary-foreground"
          : "bg-gradient-to-l from-gold/90 via-gold to-primary text-gold-foreground"
      }`}
      dir="rtl"
    >
      <div className="px-4 lg:px-8 py-2.5 flex items-center gap-3 max-w-7xl mx-auto">
        <div className="h-9 w-9 shrink-0 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
          {isMeeting ? <CalendarClock className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] uppercase tracking-wider opacity-80 shrink-0">
              {isMeeting ? "اجتماع" : "إعلان"}
            </span>
            <span className="font-bold truncate">{current.title}</span>
          </div>
          {isMeeting && current.meetingAt ? (
            <div className="flex items-center gap-2 text-xs sm:text-sm bg-black/15 rounded-lg px-2.5 py-1 w-fit">
              <span className="opacity-90">المتبقي:</span>
              <Countdown target={current.meetingAt} />
            </div>
          ) : (
            <span className="text-xs sm:text-sm opacity-90 truncate">
              {current.body?.slice(0, 120)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {visible.length > 1 && (
            <>
              <span className="text-[10px] opacity-80 hidden sm:inline">
                {index + 1} / {visible.length}
              </span>
              <button
                onClick={prev}
                className="h-7 w-7 rounded-md hover:bg-white/15 flex items-center justify-center transition"
                aria-label="السابق"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={next}
                className="h-7 w-7 rounded-md hover:bg-white/15 flex items-center justify-center transition"
                aria-label="التالي"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => dismiss(current.id)}
            className="h-7 w-7 rounded-md hover:bg-white/15 flex items-center justify-center transition"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
