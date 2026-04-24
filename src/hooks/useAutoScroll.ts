import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAutoScrollOptions {
  /** Pixels per frame; ~0.5 is a slow drift, ~1.4 a brisker glide. */
  speed?: number;
  /** Resume auto-scroll after this many ms of inactivity. */
  resumeDelay?: number;
  /** Reverse direction once each edge is reached so the row "ping-pongs". */
  pingPong?: boolean;
  /** Seamless infinite loop. Assumes content is duplicated; resets scrollLeft past half scrollWidth invisibly. */
  loop?: boolean;
  /** Initial direction: 1 = left→right (scrollLeft increases). */
  direction?: 1 | -1;
  /** Original card count before the consumer duplicates items for seamless looping. */
  loopItemCount?: number;
  /** Pixels to advance when the consumer calls scrollByPage() with a card width fallback. */
  pageStep?: number;
  /** Disable the loop entirely (e.g. when prefers-reduced-motion is on). */
  enabled?: boolean;
}

export interface UseAutoScrollReturn {
  scrollerRef: React.RefObject<HTMLDivElement>;
  pause: () => void;
  resume: () => void;
  scrollByPage: (dir: "prev" | "next") => void;
  isPaused: boolean;
  canScroll: boolean;
}

/**
 * Smooth horizontal auto-scroll for any overflow-x container.
 * - Pauses on pointer/touch interaction and resumes after `resumeDelay`.
 * - Ping-pongs at edges so a short list still feels alive.
 * - Exposes prev/next handlers wired to the same pause logic so arrow buttons
 *   feel natural alongside the auto motion.
 */
export function useAutoScroll(opts: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const {
    speed = 0.55,
    resumeDelay = 2200,
    pingPong = true,
    loop = false,
    direction = 1,
    loopItemCount = 0,
    pageStep,
    enabled = true,
  } = opts;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const dirRef = useRef<1 | -1>(direction);
  const rafRef = useRef<number | null>(null);
  const elementPollRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  const getScrollMetrics = useCallback(
    (el: HTMLDivElement) => {
      const hasLoopCopies = loop && loopItemCount > 0 && el.children.length > loopItemCount;
      const logicalScrollWidth = hasLoopCopies ? el.scrollWidth / 2 : el.scrollWidth;
      const max = Math.max(0, el.scrollWidth - el.clientWidth);
      const logicalMax = Math.max(0, logicalScrollWidth - el.clientWidth);

      return {
        hasLoopCopies,
        logicalMax,
        max,
        resetPoint: hasLoopCopies ? el.scrollWidth / 2 : max,
      };
    },
    [loop, loopItemCount]
  );

  const clearResumeTimer = () => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  };

  const pause = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
    clearResumeTimer();
  }, []);

  const resume = useCallback(() => {
    clearResumeTimer();
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false;
      setIsPaused(false);
    }, resumeDelay);
  }, [resumeDelay]);

  const measureScrollability = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !enabled) {
      setCanScroll(false);
      return false;
    }

    const { logicalMax } = getScrollMetrics(el);
    const nextCanScroll = logicalMax > 2;
    setCanScroll((prev) => (prev === nextCanScroll ? prev : nextCanScroll));

    if (!nextCanScroll) {
      clearResumeTimer();
      if (pausedRef.current) {
        pausedRef.current = false;
        setIsPaused(false);
      }
      dirRef.current = direction;
      if (Math.abs(el.scrollLeft) > 0.5) {
        el.scrollLeft = 0;
      }
    }

    return nextCanScroll;
  }, [direction, enabled, getScrollMetrics]);

  const scheduleMeasure = useCallback(() => {
    window.requestAnimationFrame(() => {
      measureScrollability();
    });
  }, [measureScrollability]);

  const scrollByPage = useCallback(
    (dir: "prev" | "next") => {
      const el = scrollerRef.current;
      if (!el || !canScroll) return;
      const step = pageStep ?? Math.max(160, Math.round(el.clientWidth * 0.85));
      if (loop) {
        const { hasLoopCopies, max, resetPoint } = getScrollMetrics(el);
        const target = dir === "next" ? el.scrollLeft + step : el.scrollLeft - step;
        if (hasLoopCopies && resetPoint > 0) {
          // For looped content (duplicated), allow seamless wrap on manual nav too.
          if (target < 0) {
            el.scrollLeft = target + resetPoint;
            el.scrollBy({ left: 0, behavior: "auto" });
            el.scrollBy({ left: -step, behavior: "smooth" });
          } else if (target > max) {
            el.scrollLeft = target - resetPoint;
            el.scrollBy({ left: 0, behavior: "auto" });
            el.scrollBy({ left: step, behavior: "smooth" });
          } else {
            el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
          }
        } else {
          let wrappedTarget = target;
          if (target < 0) {
            wrappedTarget = max;
          } else if (target > max) {
            wrappedTarget = 0;
          }
          el.scrollTo({ left: wrappedTarget, behavior: "smooth" });
        }
      } else {
        el.scrollBy({ left: dir === "next" ? step : -step, behavior: "smooth" });
      }
      pause();
      resume();
    },
    [canScroll, getScrollMetrics, pageStep, pause, resume, loop]
  );

  useEffect(() => {
    if (!enabled) {
      measureScrollability();
      return;
    }

    const waitForScroller = () => {
      if (scrollerRef.current) {
        setScrollerEl((prev) => (prev === scrollerRef.current ? prev : scrollerRef.current));
        measureScrollability();
        return;
      }
      elementPollRef.current = requestAnimationFrame(waitForScroller);
    };

    waitForScroller();

    return () => {
      if (elementPollRef.current !== null) {
        cancelAnimationFrame(elementPollRef.current);
      }
    };
  }, [enabled, measureScrollability]);

  useEffect(() => {
    const el = scrollerEl;
    if (!el) return;

    measureScrollability();

    const resizeObserver = new ResizeObserver(() => {
      scheduleMeasure();
    });
    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(() => {
      scheduleMeasure();
    });
    mutationObserver.observe(el, { childList: true, subtree: true });

    const handleWindowResize = () => {
      scheduleMeasure();
    };
    window.addEventListener("resize", handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [measureScrollability, scheduleMeasure, scrollerEl]);

  useEffect(() => {
    if (!enabled || !scrollerEl) return;

    const syncScrollability = (el: HTMLDivElement) => {
      const { logicalMax } = getScrollMetrics(el);
      const nextCanScroll = logicalMax > 2;
      setCanScroll((prev) => (prev === nextCanScroll ? prev : nextCanScroll));
      if (!nextCanScroll) {
        dirRef.current = direction;
        if (Math.abs(el.scrollLeft) > 0.5) {
          el.scrollLeft = 0;
        }
      }
      return nextCanScroll;
    };

    let lastTs = performance.now();
    dirRef.current = direction;

    const tick = (ts: number) => {
      const el = scrollerEl;
      const dt = ts - lastTs;
      lastTs = ts;
      const nextCanScroll = syncScrollability(el);

      if (!pausedRef.current && nextCanScroll) {
        // ~60fps baseline, scale by elapsed time so motion stays steady.
        const delta = speed * (dt / 16.67) * dirRef.current;
        el.scrollLeft += delta;

        const { hasLoopCopies, max, resetPoint } = getScrollMetrics(el);
        if (loop) {
          if (hasLoopCopies && resetPoint > 0) {
            // Seamless infinite loop: consumer renders a second copy of the content.
            if (el.scrollLeft >= resetPoint) {
              el.scrollLeft -= resetPoint;
            } else if (el.scrollLeft <= 0) {
              el.scrollLeft += resetPoint;
            }
          } else if (dirRef.current >= 0 && el.scrollLeft >= max - 0.5) {
            el.scrollLeft = 0;
          } else if (dirRef.current < 0 && el.scrollLeft <= 0.5) {
            el.scrollLeft = max;
          }
        } else if (pingPong) {
          if (el.scrollLeft >= max - 0.5) {
            el.scrollLeft = max;
            dirRef.current = -1;
          } else if (el.scrollLeft <= 0.5) {
            el.scrollLeft = 0;
            dirRef.current = 1;
          }
        } else {
          // wrap
          if (el.scrollLeft >= max - 0.5) el.scrollLeft = 0;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const handlePointerDown = () => {
      pause();
    };
    const handlePointerUp = () => {
      resume();
    };
    const handleMouseEnter = () => {
      pause();
    };
    const handleMouseLeave = () => {
      resume();
    };

    scrollerEl.addEventListener("pointerdown", handlePointerDown, { passive: true });
    scrollerEl.addEventListener("pointerup", handlePointerUp, { passive: true });
    scrollerEl.addEventListener("pointercancel", handlePointerUp, { passive: true });
    scrollerEl.addEventListener("touchstart", handlePointerDown, { passive: true });
    scrollerEl.addEventListener("touchend", handlePointerUp, { passive: true });
    scrollerEl.addEventListener("mouseenter", handleMouseEnter);
    scrollerEl.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      clearResumeTimer();
      scrollerEl.removeEventListener("pointerdown", handlePointerDown);
      scrollerEl.removeEventListener("pointerup", handlePointerUp);
      scrollerEl.removeEventListener("pointercancel", handlePointerUp);
      scrollerEl.removeEventListener("touchstart", handlePointerDown);
      scrollerEl.removeEventListener("touchend", handlePointerUp);
      scrollerEl.removeEventListener("mouseenter", handleMouseEnter);
      scrollerEl.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [direction, enabled, getScrollMetrics, loop, pause, resume, scrollerEl, speed, pingPong]);

  return { scrollerRef, pause, resume, scrollByPage, isPaused, canScroll };
}

export default useAutoScroll;
