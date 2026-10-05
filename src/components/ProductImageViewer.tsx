import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cldUrl } from '@/lib/cloudinaryUrl';
import { SmartImage } from '@/components/ui/smart-image';

/**
 * Full-screen product image viewer.
 *
 * The whole photo is always visible: the image keeps its natural size, capped
 * by the stage on both axes, so a tall necklace or a wide tray fits the screen
 * instead of being cut to a square. From there the shopper can zoom in -
 * pinch, double-tap/double-click, the mouse wheel, the +/- keys or the zoom
 * button - and drag to look around. Swipe or the arrow keys change photo.
 */

export interface ViewerMedia {
  type: 'image' | 'video';
  src: string;
  thumb: string;
}

interface ProductImageViewerProps {
  media: ViewerMedia[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  title: string;
  alt?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SWIPE_DISTANCE = 50;

interface View {
  scale: number;
  x: number;
  y: number;
}

const IDENTITY: View = { scale: 1, x: 0, y: 0 };
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const ProductImageViewer = ({ media, index, onIndexChange, onClose, title, alt }: ProductImageViewerProps) => {
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<View>(IDENTITY);
  const [gesturing, setGesturing] = useState(false);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startView: View;
    startDist: number;
    startMid: { x: number; y: number };
    start: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const lastTap = useRef(0);
  const lastTouchToggle = useRef(0);

  const current = media[index];
  const count = media.length;
  const zoomed = view.scale > 1.01;

  const go = useCallback((next: number) => {
    if (count < 2) return;
    onIndexChange(clamp(next, 0, count - 1));
  }, [count, onIndexChange]);

  // A different photo always opens fitted.
  useEffect(() => {
    setView(IDENTITY);
  }, [index]);

  /** Keep a zoomed image from being dragged off the stage. */
  const bounded = useCallback((next: View): View => {
    const img = imgRef.current;
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    if (!img || scale <= 1) return { scale, x: 0, y: 0 };
    const maxX = ((scale - 1) * img.offsetWidth) / 2;
    const maxY = ((scale - 1) * img.offsetHeight) / 2;
    return { scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, []);

  /** Zoom to `scale`, keeping the screen point `at` (default: centre) still. */
  const zoomTo = useCallback((scale: number, at?: { x: number; y: number }) => {
    setView((prev) => {
      const img = imgRef.current;
      if (!img) return prev;
      const rect = img.getBoundingClientRect();
      // Offset of `at` from the image's untransformed centre.
      const cx = rect.left + rect.width / 2 - prev.x;
      const cy = rect.top + rect.height / 2 - prev.y;
      const qx = at ? at.x - cx : 0;
      const qy = at ? at.y - cy : 0;
      const target = clamp(scale, MIN_SCALE, MAX_SCALE);
      const ratio = target / prev.scale;
      return bounded({ scale: target, x: qx - ratio * (qx - prev.x), y: qy - ratio * (qy - prev.y) });
    });
  }, [bounded]);

  const toggleZoom = (at?: { x: number; y: number }) => {
    if (zoomed) setView(IDENTITY);
    else zoomTo(DOUBLE_TAP_SCALE, at);
  };

  // Body scroll lock and focus: into the dialog on open, back out on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);

  // Keyboard: Escape, arrows, +/- zoom, and Tab kept inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight') {
        go(index + 1);
      } else if (e.key === 'ArrowLeft') {
        go(index - 1);
      } else if (e.key === '+' || e.key === '=') {
        setView((prev) => bounded({ ...prev, scale: prev.scale * 1.5 }));
      } else if (e.key === '-') {
        setView((prev) => bounded({ ...prev, scale: prev.scale / 1.5 }));
      } else if (e.key === 'Tab' && dialogRef.current) {
        // Keep Tab inside the dialog.
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), iframe'),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, onClose, bounded]);

  // ── Pointer gestures: pinch, pan, swipe, double-tap ──
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  const beginGesture = () => {
    const pts = Array.from(pointers.current.values());
    const mid = pts.length >= 2
      ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      : pts[0];
    gesture.current = {
      startView: view,
      startDist: pts.length >= 2 ? distance(pts[0], pts[1]) : 0,
      startMid: mid,
      start: pts[0],
      moved: gesture.current?.moved ?? false,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (current?.type !== 'image') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture is a nicety (keeps a drag going off the stage); never fatal.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current = null;
    beginGesture();
    setGesturing(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const pts = Array.from(pointers.current.values());

    if (pts.length >= 2 && g.startDist > 0) {
      const img = imgRef.current;
      if (!img) return;
      g.moved = true;
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const scale = clamp(g.startView.scale * (distance(pts[0], pts[1]) / g.startDist), MIN_SCALE, MAX_SCALE);
      const rect = img.getBoundingClientRect();
      const cx = rect.left + rect.width / 2 - view.x;
      const cy = rect.top + rect.height / 2 - view.y;
      const q0 = { x: g.startMid.x - cx, y: g.startMid.y - cy };
      const q1 = { x: mid.x - cx, y: mid.y - cy };
      const ratio = scale / g.startView.scale;
      setView(bounded({
        scale,
        x: q1.x - ratio * (q0.x - g.startView.x),
        y: q1.y - ratio * (q0.y - g.startView.y),
      }));
      return;
    }

    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
    if (g.startView.scale > 1) {
      setView(bounded({ scale: g.startView.scale, x: g.startView.x + dx, y: g.startView.y + dy }));
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const g = gesture.current;
    const wasPinch = pointers.current.size >= 2;
    pointers.current.delete(e.pointerId);

    if (pointers.current.size > 0) {
      // One finger lifted from a pinch: carry on panning from here.
      beginGesture();
      return;
    }
    setGesturing(false);
    if (!g) return;

    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;

    // Swipe to change photo, only when not zoomed in.
    if (!wasPinch && g.startView.scale <= 1 && Math.abs(dx) > SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? index + 1 : index - 1);
      return;
    }

    // Double-tap to zoom (mouse uses the native dblclick below).
    if (e.pointerType !== 'mouse' && !g.moved) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        lastTap.current = 0;
        lastTouchToggle.current = now;
        toggleZoom({ x: e.clientX, y: e.clientY });
      } else {
        lastTap.current = now;
      }
    }
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setGesturing(false);
  };

  const transition = gesturing || reduceMotion ? 'none' : 'transform 200ms cubic-bezier(0.23, 1, 0.32, 1)';

  return (
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} - photos`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="fixed inset-0 z-[100] flex flex-col bg-neutral-950 text-white"
      data-testid="image-viewer"
    >
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 sm:px-4">
        <span className="min-w-0 flex-1 truncate text-sm text-white/80" aria-live="polite">
          {count > 1 ? `${index + 1} / ${count}` : ''}
          <span className="sr-only">{zoomed ? ', zoomed in' : ''}</span>
        </span>
        {current?.type === 'image' && (
          <button
            type="button"
            onClick={() => toggleZoom()}
            className="grid h-11 w-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
            aria-pressed={zoomed}
          >
            {zoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
          </button>
        )}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="grid h-11 w-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Close photo viewer"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Stage. min-h-0 lets it shrink to the space left between the bars,
          which is what the image is capped to. */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{ touchAction: 'none', cursor: current?.type === 'image' ? (zoomed ? (gesturing ? 'grabbing' : 'grab') : 'zoom-in') : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={(e) => {
          if (current?.type !== 'image') return;
          if (Date.now() - lastTouchToggle.current < 500) return;
          toggleZoom({ x: e.clientX, y: e.clientY });
        }}
        onWheel={(e) => {
          if (current?.type !== 'image' || e.ctrlKey) return;
          zoomTo(view.scale * Math.exp(-e.deltaY * 0.0015), { x: e.clientX, y: e.clientY });
        }}
      >
        {current?.type === 'video' ? (
          <iframe
            key={index}
            src={current.src}
            title={`${title} video`}
            className="absolute inset-0 m-auto aspect-video h-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-5xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : current ? (
          <motion.img
            key={index}
            ref={imgRef}
            src={cldUrl(current.src, 'zoom')}
            alt={alt || title}
            draggable={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            // Natural size, capped by the stage on both axes: the browser keeps
            // the aspect ratio, so the full photo is always in view.
            className="absolute inset-0 m-auto h-auto max-h-[calc(100%-1.5rem)] w-auto max-w-[calc(100%-1.5rem)] select-none object-contain"
            style={{
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
              transition,
              willChange: 'transform',
            }}
            data-testid="image-viewer-img"
          />
        ) : null}

        {count > 1 && !zoomed && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-0 sm:left-4"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === count - 1}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-opacity hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-0 sm:right-4"
              aria-label="Next photo"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="shrink-0 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-2">
          <div className="mx-auto flex w-max max-w-full gap-2 overflow-x-auto">
            {media.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`${item.type === 'video' ? 'Video' : 'Photo'} ${i + 1} of ${count}`}
                aria-current={i === index ? 'true' : undefined}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-2 transition-[box-shadow,opacity] focus-visible:outline-none focus-visible:ring-white ${
                  i === index ? 'ring-white' : 'ring-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <SmartImage src={item.thumb} alt="" preset="tile" className="h-full w-full object-contain p-0.5" />
                {item.type === 'video' && (
                  <span className="absolute inset-0 grid place-items-center bg-black/30" aria-hidden="true">
                    <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ProductImageViewer;
