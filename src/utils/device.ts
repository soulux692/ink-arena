import { useEffect, useState } from "react";

/** Any touch-capable device (phones, tablets, touch laptops). */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (navigator.maxTouchPoints > 0) return true;
    if ("ontouchstart" in window) return true;
    if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Small touch device that is almost certainly a phone held in hand. */
export function isPhone(): boolean {
  if (typeof window === "undefined" || !isTouchDevice()) return false;
  try {
    const ua = navigator.userAgent || "";
    if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) return true;
    const w = window.screen?.width ?? window.innerWidth;
    const h = window.screen?.height ?? window.innerHeight;
    return Math.min(w, h) < 820;
  } catch {
    return false;
  }
}

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatch(e.matches);
    setMatch(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, [query]);
  return match;
}

/**
 * True when touch is the PRIMARY input (phones, tablets).
 * Unlike useIsTouch this stays false on touch-screen laptops where the mouse
 * is primary — so the touch overlay never steals mouse clicks.
 */
export function useCoarsePointer(): boolean {
  return useMedia("(pointer: coarse)");
}

export function useIsTouch(): boolean {
  const [touch, setTouch] = useState(isTouchDevice);
  useEffect(() => {
    setTouch(isTouchDevice());
    // a first touch upgrades desktops-with-touchscreen too
    const onTouch = () => setTouch(true);
    window.addEventListener("touchstart", onTouch, { once: true, passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, []);
  return touch;
}

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => {
    const update = () => setPhone(isPhone());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return phone;
}

/** true while the viewport is taller than wide */
export function usePortrait(): boolean {
  const mq = useMedia("(orientation: portrait)");
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const update = () => setFallback(window.innerHeight > window.innerWidth);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return mq || fallback;
}

/** Haptic tap. No-op on devices without vibration. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

interface ScreenOrientationExt extends ScreenOrientation {
  lock?: (orientation: "landscape" | "portrait" | "natural" | "any") => Promise<void>;
}

/**
 * Best-effort landscape lock for phones: enters fullscreen, then asks the OS
 * to hold landscape. Must be called from a user gesture. Never throws.
 */
export async function enterFullscreenLandscape(): Promise<boolean> {
  try {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    };
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) {
        try {
          await el.requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
        } catch {
          await el.requestFullscreen();
        }
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    }
    const orient = screen.orientation as ScreenOrientationExt | undefined;
    if (orient?.lock) {
      try {
        await orient.lock("landscape");
        return true;
      } catch {
        /* iOS Safari and some browsers refuse the lock */
      }
    }
    return !!document.fullscreenElement;
  } catch {
    return false;
  }
}
