import { useEffect, useState } from "react";
import { Download, Share, X, MoreVertical, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

type Platform =
  | "ios-safari"
  | "ios-other"
  | "android-chrome"
  | "android-firefox"
  | "android-other"
  | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ reports as Mac
    (/Macintosh/i.test(ua) && "ontouchend" in document);
  if (isIOS) {
    if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return "ios-other";
    return "ios-safari";
  }
  if (/Android/i.test(ua)) {
    if (/Firefox/i.test(ua)) return "android-firefox";
    if (/Chrome|EdgA|SamsungBrowser/i.test(ua)) return "android-chrome";
    return "android-other";
  }
  return "desktop";
}

function isInIframe() {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
}

const DISMISS_KEY = "lz_install_dismissed_at";

export function InstallAppButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMounted(true);
    setPlatform(detectPlatform());
    if (isInIframe()) return;
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (ts && Date.now() - ts < 1000 * 60 * 60 * 24 * 7) {
      setDismissed(true);
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mounted || installed || dismissed || isInIframe()) return null;

  const canPrompt = !!deferred;
  // Show on mobile platforms always (we have manual fallback instructions),
  // and on desktop only when the native prompt is available.
  const isMobile = platform !== "desktop";
  if (!canPrompt && !isMobile) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setShowHint(false);
  };

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    setShowHint((s) => !s);
  };

  const renderHint = () => {
    switch (platform) {
      case "ios-safari":
        return (
          <>
            في Safari: اضغط زر المشاركة <Share className="inline h-3.5 w-3.5 mx-1" /> في الأسفل،
            ثم اختر «إضافة إلى الشاشة الرئيسية».
          </>
        );
      case "ios-other":
        return (
          <>
            على iPhone، التثبيت متاح فقط من متصفح <b>Safari</b>. افتح الرابط في Safari ثم اضغط
            زر المشاركة <Share className="inline h-3.5 w-3.5 mx-1" /> ← «إضافة إلى الشاشة الرئيسية».
          </>
        );
      case "android-chrome":
      case "android-other":
        return (
          <>
            افتح قائمة المتصفح <MoreVertical className="inline h-3.5 w-3.5 mx-1" /> ثم اختر
            «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».
          </>
        );
      case "android-firefox":
        return (
          <>
            في Firefox: اضغط القائمة <MoreVertical className="inline h-3.5 w-3.5 mx-1" /> ثم
            «التثبيت» أو «إضافة إلى الشاشة الرئيسية».
          </>
        );
      default:
        return (
          <>
            افتح الموقع من جوالك (Android: Chrome — iPhone: Safari) لتثبيته كتطبيق.
          </>
        );
    }
  };

  return (
    <div className="fixed bottom-4 inset-x-4 z-[60] flex justify-center pointer-events-none" dir="rtl">
      <div className="pointer-events-auto max-w-md w-full rounded-2xl border border-gold/30 bg-card/95 backdrop-blur shadow-elegant p-3 flex items-center gap-3">
        <div className="flex-1 text-sm">
          <div className="font-semibold text-shimmer-gold">ثبّت التطبيق على جوالك</div>
          <div className="text-xs text-muted-foreground">
            {canPrompt ? "تثبيت بضغطة واحدة." : "وصول أسرع كأنه تطبيق أصلي."}
          </div>
          {showHint && (
            <div className="mt-2 text-xs text-foreground/80 leading-relaxed">{renderHint()}</div>
          )}
        </div>
        <Button size="sm" onClick={onClick} className="gap-1">
          {canPrompt ? <Download className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
          {canPrompt ? "ثبّت" : "كيف؟"}
        </Button>
        <button
          aria-label="إغلاق"
          onClick={dismiss}
          className="p-1 rounded-full hover:bg-muted text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}