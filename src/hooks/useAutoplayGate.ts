import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Decides when self-moving content (a carousel, a rotating quote, a hero
 * slider) is allowed to move on its own.
 *
 * Every reason to hold still is tracked separately, and the content runs only
 * when there are none left:
 *
 * - `hover`     a mouse is over it (touch "hover" is ignored, taps are `touch`)
 * - `press`     a mouse or pen button is held down on it
 * - `touch`     a finger is on it, and for `resumeDelay` ms after it lifts
 * - `scroll`    the user scrolled it themselves (wheel, trackpad, momentum),
 *               held for `resumeDelay` ms after the last scroll
 * - `focus`     keyboard focus is inside it (`:focus-visible`, so a tap on a
 *               heart icon does not freeze the row until the user taps away)
 * - `offscreen` less than `visibleThreshold` of it is in the viewport
 * - `hidden`    the tab is in the background
 * - `reduced`   the OS asks for reduced motion - then it never runs
 * - `external`  the caller said so (`paused`), e.g. a video is playing
 * - `disabled`  the caller turned it off (`enabled: false`)
 */
type Reason =
  | "hover"
  | "press"
  | "touch"
  | "scroll"
  | "focus"
  | "offscreen"
  | "hidden"
  | "reduced"
  | "external"
  | "disabled";

export interface AutoplayGateOptions {
  /** The element the user looks at and touches. `null` keeps it stopped. */
  element: HTMLElement | null;
  /** Hold still while true (a video is open or playing, a menu is open...). */
  paused?: boolean;
  /** How long to wait after a touch, press or manual scroll ends. */
  resumeDelay?: number;
  /** Set false to switch the autoplay off entirely. */
  enabled?: boolean;
  /** Share of the element that must be on screen before it may move. */
  visibleThreshold?: number;
}

export interface AutoplayGate {
  /** True when nothing is holding the content still. */
  running: boolean;
  /** True when the OS asks for reduced motion. */
  reducedMotion: boolean;
  /** Treat this moment as a user interaction: hold still for `ms` (default `resumeDelay`). */
  hold: (ms?: number) => void;
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(REDUCED_QUERY).matches;

const isKeyboardFocus = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  try {
    return target.matches(":focus-visible");
  } catch {
    // Browsers without :focus-visible: any focus counts.
    return true;
  }
};

export function useAutoplayGate({
  element,
  paused = false,
  resumeDelay = 2500,
  enabled = true,
  visibleThreshold = 0.35,
}: AutoplayGateOptions): AutoplayGate {
  const reasonsRef = useRef<Set<Reason>>(new Set<Reason>(["offscreen"]));
  const timersRef = useRef<Map<Reason, number>>(new Map());
  const [running, setRunning] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  const sync = useCallback(() => {
    setRunning(reasonsRef.current.size === 0);
  }, []);

  const clearTimer = useCallback((reason: Reason) => {
    const id = timersRef.current.get(reason);
    if (id !== undefined) {
      window.clearTimeout(id);
      timersRef.current.delete(reason);
    }
  }, []);

  const add = useCallback(
    (reason: Reason) => {
      clearTimer(reason);
      if (!reasonsRef.current.has(reason)) {
        reasonsRef.current.add(reason);
        sync();
      }
    },
    [clearTimer, sync]
  );

  const remove = useCallback(
    (reason: Reason, delay = 0) => {
      clearTimer(reason);
      if (!reasonsRef.current.has(reason)) return;
      if (delay <= 0) {
        reasonsRef.current.delete(reason);
        sync();
        return;
      }
      timersRef.current.set(
        reason,
        window.setTimeout(() => {
          timersRef.current.delete(reason);
          reasonsRef.current.delete(reason);
          sync();
        }, delay)
      );
    },
    [clearTimer, sync]
  );

  const hold = useCallback(
    (ms: number = resumeDelay) => {
      add("scroll");
      remove("scroll", ms);
    },
    [add, remove, resumeDelay]
  );

  // Caller-controlled reasons.
  useEffect(() => {
    if (paused) add("external");
    else remove("external");
  }, [paused, add, remove]);

  useEffect(() => {
    if (!enabled) add("disabled");
    else remove("disabled");
  }, [enabled, add, remove]);

  // Page-wide reasons: reduced motion and a background tab.
  useEffect(() => {
    const media =
      typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_QUERY) : null;
    const applyMotion = () => {
      const reduce = !!media?.matches;
      setReducedMotion(reduce);
      if (reduce) add("reduced");
      else remove("reduced");
    };
    const applyVisibility = () => {
      if (document.visibilityState === "hidden") add("hidden");
      else remove("hidden");
    };
    applyMotion();
    applyVisibility();
    media?.addEventListener?.("change", applyMotion);
    document.addEventListener("visibilitychange", applyVisibility);
    return () => {
      media?.removeEventListener?.("change", applyMotion);
      document.removeEventListener("visibilitychange", applyVisibility);
    };
  }, [add, remove]);

  // Element reasons: pointer, touch, focus, wheel and visibility on screen.
  useEffect(() => {
    if (!element) {
      add("offscreen");
      return;
    }

    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") add("hover");
    };
    const onPointerLeave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") remove("hover");
    };

    const onPressEnd = () => {
      window.removeEventListener("pointerup", onPressEnd);
      window.removeEventListener("pointercancel", onPressEnd);
      remove("press", resumeDelay);
    };
    const onPointerDown = (e: PointerEvent) => {
      // Fingers are tracked with touch events, which keep firing while the
      // browser pans; pointer events get cancelled the moment a swipe starts.
      if (e.pointerType === "touch") return;
      add("press");
      window.addEventListener("pointerup", onPressEnd);
      window.addEventListener("pointercancel", onPressEnd);
    };

    const onTouchStart = () => add("touch");
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) remove("touch", resumeDelay);
    };

    const onWheel = (e: WheelEvent) => {
      // Only a sideways scroll is aimed at the row; vertical wheel over it is
      // the page being scrolled past.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) hold();
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isKeyboardFocus(e.target)) add("focus");
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget;
      if (!(next instanceof Node) || !element.contains(next)) remove("focus");
    };

    element.addEventListener("pointerenter", onPointerEnter);
    element.addEventListener("pointerleave", onPointerLeave);
    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchend", onTouchEnd, { passive: true });
    element.addEventListener("touchcancel", onTouchEnd, { passive: true });
    element.addEventListener("wheel", onWheel, { passive: true });
    element.addEventListener("focusin", onFocusIn);
    element.addEventListener("focusout", onFocusOut);

    // The pointer may already be resting on it when it mounts.
    if (element.matches(":hover") && window.matchMedia?.("(hover: hover)").matches) {
      add("hover");
    }

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "function") {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry && entry.isIntersecting && entry.intersectionRatio >= visibleThreshold) {
            remove("offscreen");
          } else {
            add("offscreen");
          }
        },
        { threshold: [0, visibleThreshold, 1] }
      );
      observer.observe(element);
    } else {
      remove("offscreen");
    }

    return () => {
      element.removeEventListener("pointerenter", onPointerEnter);
      element.removeEventListener("pointerleave", onPointerLeave);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchEnd);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("focusin", onFocusIn);
      element.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("pointerup", onPressEnd);
      window.removeEventListener("pointercancel", onPressEnd);
      observer?.disconnect();
      // Interaction state belongs to this element; a new one starts clean.
      (["hover", "press", "touch", "scroll", "focus"] as Reason[]).forEach((r) => remove(r));
      add("offscreen");
    };
  }, [element, resumeDelay, visibleThreshold, add, remove, hold]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };
  }, []);

  return { running, reducedMotion, hold };
}

export default useAutoplayGate;
