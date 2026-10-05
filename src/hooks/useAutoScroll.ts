import { useCallback, useEffect, useRef, useState } from "react";
import useAutoplayGate from "@/hooks/useAutoplayGate";

/**
 * Card-by-card autoplay for a horizontal overflow-x row.
 *
 * Every `interval` ms the row glides one card along and settles, like a
 * person swiping it, then rests so the card can be read. At the end it loops:
 * seamlessly when the caller renders the items twice (`loopItemCount`),
 * otherwise by gliding back to the start.
 *
 * It holds still whenever `useAutoplayGate` says so: hover, a finger on it (and
 * a few seconds after), keyboard focus inside, the user's own scroll, the row
 * being off screen, a background tab, reduced motion, or `paused` from the
 * caller (a video playing). A touch or wheel cancels a glide mid-flight, so it
 * never fights the user's own swipe.
 *
 * Why not set `scrollLeft` from a CSS transition or `scrollTo({behavior})`:
 * this site gives every `.overflow-x-auto` `scroll-behavior: smooth` and some
 * rows use mandatory snapping, so the browser would re-animate or re-snap each
 * write. The glide switches both off on the element for its few hundred ms and
 * puts them back when it lands exactly on a card.
 */

export interface UseAutoScrollOptions {
  /** Rest between steps, ms. */
  interval?: number;
  /** How long to wait after a touch, press or manual scroll ends. */
  resumeDelay?: number;
  /** Loop at the end (always true in practice; false stops at the end). */
  loop?: boolean;
  /** 1 moves toward later cards, -1 toward earlier ones. */
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
/** iOS-like paging curve: a soft start and a long, calm settle. */
const EASE_PAGE: [number, number, number, number] = [0.32, 0.72, 0, 1];
const STEP_MS = 800;
const ARROW_MS = 450;

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

const easePage = bezier(EASE_PAGE);
const easeOut = bezier(EASE_OUT);

/**
 * The element whose children are the cards. Some rows wrap their cards in one
 * inner `w-max` flex div, so look through single-child wrappers.
 */
function getItems(el: HTMLElement): HTMLElement[] {
  let track: Element = el;
  while (track.children.length === 1 && track.firstElementChild!.children.length > 1) {
    track = track.firstElementChild!;
  }
  return Array.from(track.children).filter(
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
    interval = 3500,
    resumeDelay = 2500,
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

  const animRef = useRef<number | null>(null);
  /** Last scrollLeft this hook wrote, to tell the user's scrolls from ours. */
  const writtenRef = useRef(0);
  /** Ignore scroll events until then (settling after a glide). */
  const quietUntilRef = useRef(0);
  const loopCountRef = useRef(loopItemCount);
  loopCountRef.current = loopItemCount;

  const stopGlide = useCallback(() => {
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (el) {
      el.style.scrollSnapType = "";
      el.style.scrollBehavior = "";
    }
  }, [el]);

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

  // Keep `canScroll` honest as cards load, resize or get duplicated.
  useEffect(() => {
    if (!el) {
      setCanScroll(false);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      setCanScroll(measure(el, loopCountRef.current).canScroll);
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
  // and treat any scroll we did not make as an interaction.
  useEffect(() => {
    if (!el) return;
    const takeOver = () => stopGlide();
    const onScroll = () => {
      if (animRef.current !== null) return;
      if (performance.now() < quietUntilRef.current) {
        writtenRef.current = el.scrollLeft;
        return;
      }
      if (Math.abs(el.scrollLeft - writtenRef.current) > 2) gate.hold();
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

  // The autoplay itself. Pausing (hover, off screen) lets a glide in flight
  // land on its card; only the user's own touch or scroll cuts one short.
  useEffect(() => {
    if (!gate.running || !el) return;
    const id = window.setInterval(() => step(direction, 1, STEP_MS, easePage), interval);
    return () => window.clearInterval(id);
  }, [gate.running, el, direction, interval, step]);

  useEffect(() => stopGlide, [stopGlide]);

  const scrollByPage = useCallback(
    (dir: "prev" | "next") => {
      if (!el) return;
      gate.hold();
      const count = pageCards ?? measure(el, loopCountRef.current).perView;
      step(dir === "next" ? 1 : -1, Math.max(1, count), gate.reducedMotion ? 0 : ARROW_MS, easeOut);
    },
    [el, gate, pageCards, step]
  );

  return { scrollerRef, scrollByPage, canScroll, isRunning: gate.running };
}

export default useAutoScroll;
