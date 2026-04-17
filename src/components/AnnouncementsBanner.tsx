import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, Megaphone, X } from "lucide-react";

// Soft chime via Web Audio API — no asset required
function playChime() {
  try {
    const Ctx =
      (window.AudioContext as typeof AudioContext | undefined) ||
      ((window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext as typeof AudioContext | undefined);
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const playNote = (freq: number, start: number, dur = 0.45) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    };
    // Pleasant two-note chime (E5 → A5)
    playNote(659.25, 0);
    playNote(880, 0.18, 0.55);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* ignore audio errors */
  }
}

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
  pinned: boolean;
  meetingAt?: number;
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

function formatCountdown(target: number, now: number): string {
  const diff = target - now;
  if (diff <= 0) return "بدأ الاجتماع الآن";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff / 3600000) % 24);
  const minutes = Math.floor((diff / 60000) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  return days > 0
    ? `متبقي ${days} يوم و ${hh}:${mm}:${ss}`
    : `متبقي ${hh}:${mm}:${ss}`;
}

function TickerItem({ item, now }: { item: NormalizedItem; now: number }) {
  const isMeeting = item.kind === "meeting";
  return (
    <span className="inline-flex items-center gap-2 mx-8">
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/20">
        {isMeeting ? <CalendarClock className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}
      </span>
      <span className="text-[10px] uppercase tracking-wider opacity-80">
        {isMeeting ? "اجتماع" : "إعلان"}
      </span>
      <span className="font-bold">{item.title}</span>
      {isMeeting && item.meetingAt ? (
        <span className="bg-black/20 rounded-md px-2 py-0.5 text-xs tabular-nums">
          {formatCountdown(item.meetingAt, now)}
        </span>
      ) : (
        item.body && <span className="opacity-90">— {item.body.slice(0, 140)}</span>
      )}
      <span className="text-white/40 mx-2">•</span>
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
  const [closed, setClosed] = useState(false);
  const now = useNow(1000);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const userInteractedRef = useRef(false);

  useEffect(() => {
    const markInteracted = () => {
      userInteractedRef.current = true;
      window.removeEventListener("pointerdown", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
    window.addEventListener("pointerdown", markInteracted);
    window.addEventListener("keydown", markInteracted);
    return () => {
      window.removeEventListener("pointerdown", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, []);

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
        pinned: r.is_pinned,
      };
    });
    const filtered = normalized.filter((it) => {
      if (it.kind !== "meeting") return true;
      if (!it.meetingAt) return true;
      return it.meetingAt + 2 * 3600 * 1000 > Date.now();
    });

    // Detect newly arrived items (skip first load) and chime
    const currentIds = new Set(filtered.map((it) => it.id));
    if (knownIdsRef.current !== null) {
      const hasNew = filtered.some((it) => !knownIdsRef.current!.has(it.id));
      if (hasNew && userInteractedRef.current && !document.hidden) {
        playChime();
      }
    }
    knownIdsRef.current = currentIds;

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

  if (closed || visible.length === 0) return null;

  // Duration scales with content count (more items = longer scroll)
  const duration = Math.max(25, visible.length * 14);

  const dismissAll = () => {
    const next = [...dismissed, ...visible.map((v) => v.id)];
    setDismissed(next);
    setClosed(true);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-200)));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="relative overflow-hidden border-b bg-gradient-to-l from-primary via-primary to-gold text-primary-foreground shadow-elegant"
      dir="rtl"
    >
      <div className="flex items-center">
        <div className="shrink-0 z-10 bg-gold text-gold-foreground px-4 py-2 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md">
          <Megaphone className="h-4 w-4 animate-pulse" />
          <span>عاجل</span>
        </div>

        <div
          className="flex-1 overflow-hidden py-2 relative"
          style={{ maskImage: "linear-gradient(to left, transparent, black 5%, black 95%, transparent)" }}
        >
          <div
            className="flex whitespace-nowrap animate-marquee text-sm"
            style={{ ["--marquee-duration" as string]: `${duration}s` }}
            dir="ltr"
          >
            <div className="flex" dir="rtl">
              {visible.map((item) => (
                <TickerItem key={`a-${item.id}`} item={item} now={now} />
              ))}
            </div>
            <div className="flex" dir="rtl" aria-hidden="true">
              {visible.map((item) => (
                <TickerItem key={`b-${item.id}`} item={item} now={now} />
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={dismissAll}
          className="shrink-0 h-8 w-8 mx-2 rounded-md hover:bg-white/15 flex items-center justify-center transition"
          aria-label="إغلاق الشريط"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
