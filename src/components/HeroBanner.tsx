import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { subscribeToActiveBanners, Banner } from "@/services/bannerService";
import { useNavigate } from "react-router-dom";

/**
 * Seamless looping hero carousel.
 *
 * Advances one banner at a time with a standard jewellery-site carousel feel.
 * The first slide is cloned at the end of the track so looping from the last
 * banner back to the first does not produce a visible reset.
 */
const HeroBanner = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagesReady, setImagesReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionsEnabled, setTransitionsEnabled] = useState(true);
  const preloadedImages = useRef<Map<string, HTMLImageElement>>(new Map());

  const getBannerImageSources = (banner: Banner) =>
    [banner.imageUrl, banner.mobileImageUrl].filter((value): value is string => Boolean(value));

  useEffect(() => {
    const unsubscribe = subscribeToActiveBanners(
      (activeBanners) => {
        setBanners(activeBanners);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading banners:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (banners.length === 0) {
      setImagesReady(true);
      return;
    }
    setImagesReady(false);
    let cancelled = false;
    const urls = [...new Set(banners.flatMap(getBannerImageSources))];
    if (urls.length === 0) {
      setImagesReady(true);
      return;
    }

    Promise.allSettled(
      urls.map((url) => {
        if (preloadedImages.current.has(url)) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            preloadedImages.current.set(url, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = url;
        });
      })
    ).then(() => {
      if (!cancelled) setImagesReady(true);
    });

    const fallbackTimer = setTimeout(() => setImagesReady(true), 3000);
    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, [banners]);

  const handleBannerClick = (banner: Banner) => {
    if (!banner.redirectLink) return;
    if (banner.redirectLink.startsWith("http")) {
      window.open(banner.redirectLink, "_blank");
    } else {
      navigate(banner.redirectLink);
    }
  };

  const hasMultipleBanners = banners.length > 1;
  const displayBanners = useMemo(
    () => (hasMultipleBanners ? [...banners, banners[0]] : banners),
    [banners, hasMultipleBanners]
  );

  useEffect(() => {
    setCurrentIndex(0);
    setTransitionsEnabled(true);
  }, [banners.length]);

  useEffect(() => {
    if (!hasMultipleBanners || isPaused || loading || !imagesReady) return;

    const interval = window.setInterval(() => {
      setCurrentIndex((prev) => prev + 1);
    }, 4200);

    return () => window.clearInterval(interval);
  }, [hasMultipleBanners, isPaused, loading, imagesReady]);

  const jumpToSlide = (index: number) => {
    setTransitionsEnabled(true);
    setCurrentIndex(index);
  };

  const goToPrev = () => {
    if (!hasMultipleBanners) return;
    setIsPaused(true);
    setTransitionsEnabled(true);
    setCurrentIndex((prev) => {
      const realIdx = ((prev % banners.length) + banners.length) % banners.length;
      return realIdx === 0 ? banners.length - 1 : realIdx - 1;
    });
    window.setTimeout(() => setIsPaused(false), 4200);
  };

  const goToNext = () => {
    if (!hasMultipleBanners) return;
    setIsPaused(true);
    setTransitionsEnabled(true);
    setCurrentIndex((prev) => prev + 1);
    window.setTimeout(() => setIsPaused(false), 4200);
  };

  const touchStartXRef = useRef<number | null>(null);

  const handleTrackTransitionEnd = () => {
    if (!hasMultipleBanners || currentIndex < banners.length) return;

    setTransitionsEnabled(false);
    setCurrentIndex(0);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setTransitionsEnabled(true);
      });
    });
  };

  const activeDotIndex = banners.length === 0 ? 0 : currentIndex % banners.length;

  if (loading || !imagesReady) {
    return (
      <section className="relative aspect-[4/5] lg:aspect-auto lg:h-[520px] flex items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-light tracking-wider">Loading</span>
        </div>
      </section>
    );
  }

  if (banners.length === 0) {
    return (
      <section className="relative aspect-[4/5] lg:aspect-auto lg:h-[520px] flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-3xl">✨</span>
          </div>
          <h2
            className="text-2xl md:text-3xl font-semibold text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Welcome to Sreerasthu Silvers
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-md">
            We're setting up our store with amazing collections. Stay tuned — something beautiful is on its way!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden bg-background"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative px-3 pt-1 lg:px-4">
        <div
          className="relative overflow-hidden rounded-[28px] shadow-[0_30px_80px_-55px_rgba(0,0,0,0.55)]"
          onTouchStart={(e) => {
            touchStartXRef.current = e.touches[0]?.clientX ?? null;
            setIsPaused(true);
          }}
          onTouchEnd={(e) => {
            const startX = touchStartXRef.current;
            const endX = e.changedTouches[0]?.clientX ?? null;
            touchStartXRef.current = null;
            setIsPaused(false);
            if (startX !== null && endX !== null) {
              const dx = endX - startX;
              if (Math.abs(dx) > 40) {
                if (dx < 0) goToNext();
                else goToPrev();
              }
            }
          }}
        >
          <div
            className="flex"
            onTransitionEnd={handleTrackTransitionEnd}
            style={{
              transform: `translate3d(-${currentIndex * 100}%, 0, 0)`,
              transition: transitionsEnabled ? "transform 850ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
            }}
          >
            {displayBanners.map((banner, idx) => (
              <button
                type="button"
                key={`${banner.id || banner.imageUrl}-${idx}`}
                onClick={() => handleBannerClick(banner)}
                className="relative aspect-[4/5] w-full flex-shrink-0 cursor-pointer overflow-hidden bg-black text-left lg:aspect-auto lg:h-[500px] xl:h-[560px]"
                aria-label={`Hero banner ${((idx % banners.length) || 0) + 1}`}
              >
                <picture>
                  <source media="(max-width: 1023px)" srcSet={banner.mobileImageUrl || banner.imageUrl} />
                  <img
                    src={banner.imageUrl}
                    alt={`Hero banner ${((idx % banners.length) || 0) + 1}`}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                    draggable={false}
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/15 to-black/20 lg:from-black/55 lg:via-black/10 lg:to-black/25" />
                <div className="absolute inset-x-0 bottom-0 top-auto p-5 lg:p-8">
                  <div className="flex items-center gap-2">
                    <span className="h-px w-8 bg-white/45" />
                    <span className="text-[10px] uppercase tracking-[0.32em] text-white/70">Sreerasthu Silvers</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {hasMultipleBanners && (
            <>
              <button
                type="button"
                onClick={goToPrev}
                aria-label="Previous banner"
                className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 sm:grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md transition hover:bg-black/50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goToNext}
                aria-label="Next banner"
                className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 sm:grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md transition hover:bg-black/50"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          {hasMultipleBanners && (
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-transparent px-2 py-1 lg:bottom-5">
              {banners.map((_, index) => (
                <button
                  key={`hero-dot-${index}`}
                  type="button"
                  onClick={() => jumpToSlide(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    activeDotIndex === index ? "w-8 bg-white" : "w-1.5 bg-white/45"
                  }`}
                  aria-label={`Go to banner ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
