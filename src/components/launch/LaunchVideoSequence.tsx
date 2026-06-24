import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Sparkles, Volume2, VolumeX } from "lucide-react";

// A self-contained ceremonial "video" sequence built from React scenes,
// synchronized with Arabic narration generated server-side via the Lovable
// AI Gateway. After all scenes finish, calls onFinished() so the parent
// can redirect to the platform homepage.

type Scene = {
  id: string;
  narration: string;
  minDurationMs: number; // fallback if audio fails or finishes too fast
  render: () => React.ReactNode;
};

const PLACEHOLDER_IMAGES = [
  { id: 1, label: "اجتماعات اللجنة" },
  { id: 2, label: "تنظيم حفل الزواج" },
  { id: 3, label: "أعمال التوثيق" },
  { id: 4, label: "الإسهامات الميدانية" },
  { id: 5, label: "ثمار العطاء" },
];

export function LaunchVideoSequence({
  onFinished,
  testMode = false,
}: {
  onFinished: () => void;
  testMode?: boolean;
}) {
  const scenes = useMemo<Scene[]>(
    () => [
      {
        id: "opening",
        narration:
          "بسم الله الرحمن الرحيم، نُدشّن اليوم منصة الزواج الجماعي لعائلة الهِملة من قريش.",
        minDurationMs: 6000,
        render: () => (
          <SceneOpening />
        ),
      },
      {
        id: "heritage",
        narration:
          "صرحٌ رقمي يوثّق مسيرة العطاء، ويحفظ ذاكرة اللجنة لأبناء القبيلة.",
        minDurationMs: 6000,
        render: () => (
          <SceneTitle
            primary="منصة الزواج الجماعي"
            secondary="لعائلة الهِملة من قريش"
            caption="ذاكرةٌ رقمية تحفظ الأثر وتوثّق العطاء"
          />
        ),
      },
      {
        id: "mission",
        narration:
          "منصةٌ تجمع شتات الجهود، وتنظم العمل، وتُيسّر التواصل بين اللجان والأعضاء.",
        minDurationMs: 6500,
        render: () => (
          <SceneMission />
        ),
      },
      {
        id: "gallery",
        narration:
          "من أعمال لجاننا: تخطيطٌ، وتنفيذ، وتوثيق، بأيدي رجالٍ من أبناء القبيلة الكرام.",
        minDurationMs: 12000,
        render: () => <SceneGallery />,
      },
      {
        id: "declaration",
        narration:
          "تم بحمد الله تدشين منصة الزواج الجماعي رسميًا. نسأل الله التوفيق والسداد.",
        minDurationMs: 6500,
        render: () => <SceneDeclaration />,
      },
    ],
    [],
  );

  const [sceneIndex, setSceneIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [audioUrls, setAudioUrls] = useState<(string | null)[]>(() =>
    scenes.map(() => null),
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const finishedRef = useRef(false);

  // Pre-generate narration audio for all scenes in parallel.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      scenes.map(async (scene) => {
        try {
          const res = await fetch("/api/public/launch-narration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: scene.narration }),
          });
          if (!res.ok) return null;
          const blob = await res.blob();
          return URL.createObjectURL(blob);
        } catch {
          return null;
        }
      }),
    ).then((urls) => {
      if (!cancelled) setAudioUrls(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [scenes]);

  // Advance scenes: wait for max(audio end, minDuration) then move on.
  useEffect(() => {
    if (sceneIndex >= scenes.length) return;
    const scene = scenes[sceneIndex];
    const url = audioUrls[sceneIndex];
    const startedAt = Date.now();
    let audioEnded = !url || muted;
    let timeoutHit = false;

    const tryAdvance = () => {
      if (!audioEnded || !timeoutHit) return;
      if (sceneIndex + 1 >= scenes.length) {
        if (finishedRef.current) return;
        finishedRef.current = true;
        // Small breath before redirecting.
        setTimeout(() => onFinished(), 1200);
      } else {
        setSceneIndex((i) => i + 1);
      }
    };

    const minTimer = setTimeout(() => {
      timeoutHit = true;
      tryAdvance();
    }, scene.minDurationMs);

    let audio: HTMLAudioElement | null = null;
    if (url && !muted) {
      audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {
        audioEnded = true;
        tryAdvance();
      });
      audio.onended = () => {
        audioEnded = true;
        // Ensure scene shows at least minDuration even if audio is shorter.
        const elapsed = Date.now() - startedAt;
        if (elapsed >= scene.minDurationMs) {
          timeoutHit = true;
        }
        tryAdvance();
      };
      audio.onerror = () => {
        audioEnded = true;
        tryAdvance();
      };
    }

    return () => {
      clearTimeout(minTimer);
      if (audio) {
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIndex, audioUrls, muted]);

  // Cleanup blob URLs on unmount.
  useEffect(() => {
    return () => {
      audioUrls.forEach((u) => u && URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentScene = scenes[Math.min(sceneIndex, scenes.length - 1)];
  const progress = Math.min(
    100,
    ((sceneIndex + (finishedRef.current ? 1 : 0)) / scenes.length) * 100,
  );

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 bg-primary text-primary-foreground overflow-hidden flex items-center justify-center"
    >
      {/* Ambient ceremonial background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[1100px] h-[1100px] rounded-full bg-gold/8 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,oklch(0.82_0.1_90_/_0.18)_0%,transparent_65%)] animate-ceremonial-bloom" />
      </div>

      {/* Gold borders */}
      <div className="absolute top-10 left-10 right-10 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      <div className="absolute bottom-10 left-10 right-10 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

      {/* Header: logo + test badge */}
      <div className="absolute top-6 inset-x-0 flex flex-col items-center gap-2 z-20">
        <div className="rounded-full bg-primary-foreground/10 p-2.5 ring-1 ring-gold/30">
          <Logo size={36} withText={false} />
        </div>
        {testMode && (
          <div className="rounded-full bg-gold/20 border border-gold/60 text-gold px-4 py-1 text-xs sm:text-sm font-semibold">
            وضع التجربة
          </div>
        )}
      </div>

      {/* Scene */}
      <div
        key={currentScene.id}
        className="relative z-10 w-full max-w-5xl mx-auto px-6 animate-scene-in"
      >
        {currentScene.render()}
      </div>

      {/* Mute toggle */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute bottom-20 left-6 z-30 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground p-3 ring-1 ring-gold/30 transition"
        aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[60%] max-w-md h-1 rounded-full bg-primary-foreground/15 overflow-hidden z-20">
        <div
          className="h-full bg-gradient-to-l from-gold to-gold/60 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function SceneOpening() {
  return (
    <div className="text-center space-y-10">
      <div className="flex justify-center">
        <div className="rounded-full bg-primary-foreground/10 p-8 ring-2 ring-gold/40 shadow-elegant">
          <Logo size={120} withText={false} />
        </div>
      </div>
      <p className="text-3xl sm:text-5xl lg:text-6xl font-bold text-gold tracking-wide">
        بسم الله الرحمن الرحيم
      </p>
      <p className="text-lg sm:text-2xl text-primary-foreground/80">
        لحظة تأسيسية في مسيرة العطاء
      </p>
    </div>
  );
}

function SceneTitle({
  primary,
  secondary,
  caption,
}: {
  primary: string;
  secondary: string;
  caption: string;
}) {
  return (
    <div className="text-center space-y-8">
      <h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
        {primary}
      </h2>
      <p className="text-2xl sm:text-4xl lg:text-5xl text-gold font-semibold">
        {secondary}
      </p>
      <div className="mx-auto w-32 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
      <p className="mx-auto max-w-2xl text-lg sm:text-2xl text-primary-foreground/85 leading-relaxed">
        {caption}
      </p>
    </div>
  );
}

function SceneMission() {
  const items = [
    "تنظيم اللجان",
    "توثيق الأعمال",
    "إدارة المالية",
    "حفظ الذاكرة",
  ];
  return (
    <div className="text-center space-y-10">
      <h3 className="text-3xl sm:text-5xl font-bold text-primary-foreground">
        رسالة المنصة
      </h3>
      <p className="mx-auto max-w-3xl text-lg sm:text-2xl text-primary-foreground/85 leading-relaxed">
        منصةٌ تجمع شتات الجهود، وتنظّم العمل، وتُيسّر التواصل بين اللجان والأعضاء
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto pt-4">
        {items.map((label, i) => (
          <div
            key={label}
            className="rounded-xl bg-primary-foreground/8 ring-1 ring-gold/30 px-4 py-5 text-base sm:text-lg text-primary-foreground/90 font-medium animate-fade-in"
            style={{ animationDelay: `${i * 250}ms` }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneGallery() {
  return (
    <div className="text-center space-y-8">
      <h3 className="text-3xl sm:text-5xl font-bold text-primary-foreground">
        من أعمال اللجان
      </h3>
      <p className="text-lg sm:text-xl text-primary-foreground/75">
        لمحات من جهود أبناء القبيلة
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto pt-4">
        {PLACEHOLDER_IMAGES.map((img, i) => (
          <div
            key={img.id}
            className="aspect-[4/5] rounded-xl bg-gradient-to-br from-primary-foreground/10 to-gold/10 ring-1 ring-gold/40 flex flex-col items-center justify-center p-4 text-center animate-fade-in shadow-elegant"
            style={{ animationDelay: `${i * 350}ms` }}
          >
            <Sparkles className="h-8 w-8 text-gold/70 mb-3" />
            <div className="text-sm sm:text-base text-primary-foreground/85 font-medium">
              {img.label}
            </div>
            <div className="mt-2 text-[10px] text-primary-foreground/40">
              صورة رقم {img.id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneDeclaration() {
  return (
    <div className="text-center space-y-10">
      <div className="mx-auto w-32 h-32 sm:w-44 sm:h-44 rounded-full bg-gold/20 flex items-center justify-center ring-4 ring-gold/40 shadow-elegant animate-scale-in">
        <Sparkles className="h-16 w-16 sm:h-20 sm:w-20 text-gold" />
      </div>
      <h2 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-primary-foreground tracking-tight">
        تم تدشين المنصة رسميًا
      </h2>
      <p className="text-2xl sm:text-3xl text-gold font-semibold">
        بحمد الله وتوفيقه
      </p>
      <p className="text-base sm:text-lg text-primary-foreground/70">
        نسأل الله التوفيق والسداد لما فيه الخير
      </p>
    </div>
  );
}