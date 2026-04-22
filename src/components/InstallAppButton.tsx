import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
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

function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
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
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
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

  if (installed || dismissed || isInIframe()) return null;

  const ios = isIOS();
  const canPrompt = !!deferred;
  if (!canPrompt && !ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setShowIosHint(false);
  };

  const onClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (ios) setShowIosHint(true);
  };

  return (
    <div className="fixed bottom-4 inset-x-4 z-[60] flex justify-center pointer-events-none" dir="rtl">
      <div className="pointer-events-auto max-w-md w-full rounded-2xl border border-gold/30 bg-card/95 backdrop-blur shadow-elegant p-3 flex items-center gap-3">
        <div className="flex-1 text-sm">
          <div className="font-semibold text-shimmer-gold">ثبّت التطبيق على جوالك</div>
          <div className="text-xs text-muted-foreground">وصول أسرع كأنه تطبيق أصلي.</div>
          {showIosHint && (
            <div className="mt-2 text-xs text-foreground/80 leading-relaxed">
              في Safari: اضغط أيقونة <Share className="inline h-3.5 w-3.5 mx-1" /> ثم
              «إضافة إلى الشاشة الرئيسية».
            </div>
          )}
        </div>
        <Button size="sm" onClick={onClick} className="gap-1">
          <Download className="h-4 w-4" />
          ثبّت
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