import { useCallback, useEffect, useRef, useState } from "react";
import useAutoplayGate from "@/hooks/useAutoplayGate";

/**
 * Continuous autoplay for a horizontal overflow-x row: the row drifts slowly
 * and steadily, like a marquee, and loops seamlessly when the caller renders
 * the items twice (`loopItemCount`); without copies it turns around at the ends.
 *
 * It holds still whenever `useAutoplayGate` says so: a mouse over it (it moves
 * again the moment the mouse leaves), a finger on it (it moves again as soon
 * as the swipe settles), keyboard focus inside, the row being off screen, a
 * background tab, reduced motion, or `paused` from the caller (a video
 * playing). Every start eases in, so it never lurches.
 *
 * Smoothness: browsers round `scrollLeft` to whole pixels, so a drift of
 * ~40 px/s through `scrollLeft` alone would step 1 px, 1 px, 0 px... and
 * judder. The whole pixels go to `scrollLeft` (so a swipe or the arrows carry
 * on from where the row really is) and the leftover fraction goes to a
 * `transform` on the inner track. Callers wrap their cards in one inner flex
 * div so there is a track to move.
 *
 * This site gives every `.overflow-x-auto` `scroll-behavior: smooth`, and some
 * rows snap. Both would re-animate or re-snap each write, so they are switched
 * off on the row for as long as it autoplays.
 */

export interface UseAutoScrollOptions {
  /** Drift speed, px per second. */
  speed?: number;
  /** How long to wait after a touch, press or manual scroll ends. */
  resumeDelay?: number;
  /** Loop at the end (always true in practice; false stops at the end). */
  loop?: boolean;
  /** 1: cards travel right to left (toward later cards); -1: left to right. */
  direction?: 1 | -1;
  /** Item count before the caller duplicated them for a seamless loop. */
  loopItemCount?: number;
  /** Cards moved by the arrow buttons; defaults to however many fit. */
  pageCards?: number;
  /** Hold still while true, e.g. a video in the row is playing. */
  paused?: boolean;
  /** Switch autoplay off entirely (arrows keep working). */
  enabled?: boolean;
}

export interface UseAutoScrollReturn {
  /** Callback ref for the scrolling element. */
  scrollerRef: (node: HTMLDivElement | null) => void;
  /** Arrow-button handler: moves a page of cards and holds autoplay briefly. */
  scrollByPage: (dir: "prev" | "next") => void;
  /** True when the content (one copy of it) is wider than the row. */
  canScroll: boolean;
  /** True while autoplay is allowed to move. */
  isRunning: boolean;
}

/** Strong ease-out: arrow presses respond at once. */
const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];
const ARROW_MS = 450;
/** Default drift speed, px per second: calm enough to read a card as it passes. */
const DRIFT_SPEED = 40;
/** Each start eases up to full speed over this long. */
const RAMP_MS = 450;
/** After a finger lifts or a swipe's momentum ends, wait this long. */
const SETTLE_MS = 300;
/** After an arrow press, let the row rest so the new card can be seen. */
const ARROW_HOLD_MS = 1600;

/** Standard cubic-bezier timing function solved for x (Newton, then bisection). */
function bezier([x1, y1, x2, y2]: [number, number, number, number]) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = sx(t) - x;
      const d = dx(t);
      if (Math.abs(err) < 1e-5) return sy(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-5) break;
      if (v < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

const easeOut = bezier(EASE_OUT);

/**
 * The element whose children are the cards. Some rows wrap their cards in one
 * inner `w-max` flex div, so look through single-child wrappers.
 */
function getTrack(el: HTMLElement): HTMLElement {
  let track: Element = el;
  while (track.children.length === 1 && track.firstElementChild!.children.length > 1) {
    track = track.firstElementChild!;
  }
  return track as HTMLElement;
}

function getItems(el: HTMLElement): HTMLElement[] {
  return Array.from(getTrack(el).children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c.offsetWidth > 0
  );
}

interface Layout {
  /** Resting scrollLeft for each card (unclamped). */
  targets: number[];
  /** Distance between a card and its copy; 0 without copies. */
  resetPoint: number;
  max: number;
  /** Cards that fit in the row at once. */
  perView: number;
  canScroll: boolean;
}

function measure(el: HTMLElement, loopItemCount: number): Layout {
  const items = getItems(el);
  const elLeft = el.getBoundingClientRect().left;
  const base = el.scrollLeft - elLeft;
  const max = Math.max(0, el.scrollWidth - el.clientWidth);
  const lefts = items.map((item) => item.getBoundingClientRect().left + base);

  const align = items[0] ? getComputedStyle(items[0]).scrollSnapAlign || "" : "";
  const first = lefts[0] ?? 0;
  const targets = items.map((item, i) => {
    if (align.includes("center")) return lefts[i] + item.offsetWidth / 2 - el.clientWidth / 2;
    if (align.includes("end")) return lefts[i] + item.offsetWidth - el.clientWidth;
    // Start alignment, measured from the first card so card 0 rests at 0 and
    // the row's own padding is kept.
    return lefts[i] - first;
  });

  const hasCopies = loopItemCount > 0 && items.length >= loopItemCount * 2;
  const resetPoint = hasCopies ? lefts[loopItemCount] - first : 0;
  const singleWidth = hasCopies ? el.scrollWidth - resetPoint : el.scrollWidth;
  const stride = items.length > 1 ? lefts[1] - lefts[0] : items[0]?.offsetWidth || el.clientWidth;

  return {
    targets,
    resetPoint,
    max,
    perView: Math.max(1, Math.floor((el.clientWidth + 1) / Math.max(1, stride))),
    canScroll: singleWidth - el.clientWidth > 2 && items.length > 1,
  };
}

function nearestIndex(targets: number[], pos: number, max: number) {
  let best = 0;
  let bestDist = Infinity;
  targets.forEach((t, i) => {
    const d = Math.abs(Math.min(Math.max(t, 0), max) - pos);
    if (d < bestDist - 0.5) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

export function useAutoScroll(opts: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const {
    speed = DRIFT_SPEED,
    resumeDelay = SETTLE_MS,
    loop = true,
    direction = 1,
    loopItemCount = 0,
    pageCards,
    paused = false,
    enabled = true,
  } = opts;

  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [canScroll, setCanScroll] = useState(false);
  const scrollerRef = useCallback((node: HTMLDivElement | null) => setEl(node), []);

  const gate = useAutoplayGate({
    element: el,
    paused,
    enabled: enabled && canScroll,
    resumeDelay,
  });

  /** Arrow-button glide in flight. */
  const animRef = useRef<number | null>(null);
  /** Last scrollLeft this hook wrote, to tell the user's scrolls from ours. */
  const writtenRef = useRef(0);
  /** Ignore scroll events until then (settling after a glide). */
  const quietUntilRef = useRef(0);
  const loopCountRef = useRef(loopItemCount);
  loopCountRef.current = loopItemCount;
  const layoutRef = useRef<Layout | null>(null);
  /** Snap and smooth scrolling stay off while the row autoplays. */
  const lockedRef = useRef(false);
  const autoplays = enabled && canScroll && !gate.reducedMotion;

  const restoreScrollStyle = useCallback(() => {
    if (!el) return;
    el.style.scrollSnapType = lockedRef.current ? "none" : "";
    el.style.scrollBehavior = lockedRef.current ? "auto" : "";
  }, [el]);

  useEffect(() => {
    if (!el) return;
    lockedRef.current = autoplays;
    restoreScrollStyle();
    return () => {
      lockedRef.current = false;
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
    };
  }, [el, autoplays, restoreScrollStyle]);

  const stopGlide = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    restoreScrollStyle();
  }, [restoreScrollStyle]);

  /** Glide from `from` to `to`; `from` differs from scrollLeft after a loop jump. */
  const glide = useCallback(
    (from: number, to: number, duration: number, ease: (x: number) => number) => {
      if (!el) return;
      stopGlide();
      el.style.scrollSnapType = "none";
      el.style.scrollBehavior = "auto";
      el.scrollLeft = from;
      writtenRef.current = el.scrollLeft;

      if (duration <= 0 || Math.abs(to - from) < 1) {
        el.scrollLeft = to;
        writtenRef.current = el.scrollLeft;
        quietUntilRef.current = performance.now() + 200;
        stopGlide();
        return;
      }

      const start = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        el.scrollLeft = from + (to - from) * ease(t);
        writtenRef.current = el.scrollLeft;
        if (t < 1) {
          animRef.current = requestAnimationFrame(frame);
        } else {
          animRef.current = null;
          quietUntilRef.current = performance.now() + 200;
          stopGlide();
        }
      };
      animRef.current = requestAnimationFrame(frame);
    },
    [el, stopGlide]
  );

  /** Move `count` cards in `dir`, looping at either end. */
  const step = useCallback(
    (dir: 1 | -1, count: number, duration: number, ease: (x: number) => number) => {
      if (!el) return;
      const layout = measure(el, loopCountRef.current);
      if (!layout.canScroll) return;
      const { targets, resetPoint, max } = layout;
      const clamp = (v: number) => Math.min(Math.max(v, 0), max);

      let pos = el.scrollLeft;
      // Seamless loop: hop to the identical spot in the other copy first.
      if (resetPoint > 0) {
        if (dir > 0 && pos >= resetPoint - 0.5) pos -= resetPoint;
        else if (dir < 0 && pos + resetPoint <= max + 0.5) {
          const idx = nearestIndex(targets, pos, max);
          if (idx - count < 0) pos += resetPoint;
        }
      }

      const cur = nearestIndex(targets, pos, max);
      const nextIdx = cur + dir * count;
      let target: number;
      if (nextIdx < 0 || nextIdx >= targets.length || Math.abs(clamp(targets[nextIdx]) - pos) < 1) {
        if (!loop) return;
        // No copies to hop through: go back to the other end.
        target = dir > 0 ? 0 : max;
        duration = gate.reducedMotion ? 0 : Math.max(duration, 1100);
      } else {
        target = clamp(targets[nextIdx]);
      }
      glide(pos, target, duration, ease);
    },
    [el, glide, loop, gate.reducedMotion]
  );

  // Keep `canScroll` and the cached layout honest as cards load, resize or
  // get duplicated.
  useEffect(() => {
    if (!el) {
      layoutRef.current = null;
      setCanScroll(false);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const layout = measure(el, loopCountRef.current);
      layoutRef.current = layout;
      setCanScroll(layout.canScroll);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    const mo = new MutationObserver(schedule);
    mo.observe(el, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }, [el, loopItemCount]);

  // The user's own input wins: stop a glide the instant they touch or scroll,
  // and treat any scroll we did not make (a swipe's momentum after the finger
  // lifts) as an interaction, so the drift waits until it settles.
  useEffect(() => {
    if (!el) return;
    const takeOver = () => stopGlide();
    const onScroll = () => {
      if (animRef.current !== null) return;
      if (performance.now() < quietUntilRef.current) {
        writtenRef.current = el.scrollLeft;
        return;
      }
      if (Math.abs(el.scrollLeft - writtenRef.current) > 2) {
        writtenRef.current = el.scrollLeft;
        gate.hold();
      }
    };
    el.addEventListener("pointerdown", takeOver, { passive: true });
    el.addEventListener("touchstart", takeOver, { passive: true });
    el.addEventListener("wheel", takeOver, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    writtenRef.current = el.scrollLeft;
    return () => {
      el.removeEventListener("pointerdown", takeOver);
      el.removeEventListener("touchstart", takeOver);
      el.removeEventListener("wheel", takeOver);
      el.removeEventListener("scroll", onScroll);
    };
  }, [el, gate.hold, stopGlide]);

  // The drift itself: one frame loop while nothing holds the row still.
  useEffect(() => {
    if (!gate.running || !el || gate.reducedMotion) return;
    const track = getTrack(el);
    const moveTrack = track !== el;
    if (moveTrack) track.style.willChange = "transform";

    let raf = 0;
    let pos = el.scrollLeft;
    let dir: 1 | -1 = direction;
    const startedAt = performance.now();
    let last = startedAt;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // A long gap (a dropped frame, a busy main thread) must not become a jump.
      const dt = Math.min(Math.max(now - last, 0), 50) / 1000;
      last = now;
      if (animRef.current !== null) {
        pos = el.scrollLeft;
        return;
      }
      const layout = layoutRef.current ?? measure(el, loopCountRef.current);
      layoutRef.current = layout;
      if (!layout.canScroll) return;
      const { resetPoint, max } = layout;

      const r = Math.min(1, (now - startedAt) / RAMP_MS);
      const ramp = r * r * (3 - 2 * r);
      pos += dir * speed * ramp * dt;

      if (resetPoint > 0) {
        // Seamless loop: the copy at `resetPoint` looks identical to card 0.
        // (A turn-around made before the copies rendered no longer applies.)
        dir = direction;
        if (pos >= resetPoint) pos -= resetPoint;
        else if (pos < 0) pos += resetPoint;
      } else if (pos >= max) {
        if (!loop) return;
        pos = max;
        dir = -1;
      } else if (pos <= 0) {
        if (!loop) return;
        pos = 0;
        dir = 1;
      }

      el.scrollLeft = Math.floor(pos);
      const actual = el.scrollLeft;
      writtenRef.current = actual;
      if (moveTrack) track.style.transform = `translate3d(${(actual - pos).toFixed(3)}px,0,0)`;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (moveTrack) {
        track.style.transform = "";
        track.style.willChange = "";
      }
      writtenRef.current = el.scrollLeft;
    };
  }, [gate.running, gate.reducedMotion, el, direction, speed, loop]);

  useEffect(() => stopGlide, [stopGlide]);

  const scrollByPage = useCallback(
    (dir: "prev" | "next") => {
      if (!el) return;
      gate.hold(ARROW_HOLD_MS);
      const count = pageCards ?? measure(el, loopCountRef.current).perView;
      step(dir === "next" ? 1 : -1, Math.max(1, count), gate.reducedMotion ? 0 : ARROW_MS, easeOut);
    },
    [el, gate, pageCards, step]
  );

  return { scrollerRef, scrollByPage, canScroll, isRunning: gate.running };
}

export default useAutoScroll;
