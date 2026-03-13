import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { subscribeToActiveBanners, Banner } from "@/services/bannerService";
import { useNavigate } from "react-router-dom";

const HeroBanner = () => {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [direction, setDirection] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);
  const preloadedImages = useRef<Map<string, HTMLImageElement>>(new Map());
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isSwiping = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeToActiveBanners(
      (activeBanners) => {
        setBanners(activeBanners);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading banners:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (banners.length === 0) return;
    let loadedCount = 0;
    const totalImages = banners.length;
    banners.forEach((banner) => {
      if (preloadedImages.current.has(banner.imageUrl)) {
        loadedCount++;
        if (loadedCount >= totalImages) setImagesReady(true);
        return;
      }
      const img = new Image();
      img.onload = () => {
        preloadedImages.current.set(banner.imageUrl, img);
        loadedCount++;
        if (loadedCount >= totalImages) setImagesReady(true);
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount >= totalImages) setImagesReady(true);
      };
      img.src = banner.imageUrl;
    });
    const fallbackTimer = setTimeout(() => setImagesReady(true), 3000);
    return () => clearTimeout(fallbackTimer);
  }, [banners]);

  const nextSlide = useCallback(() => {
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const prevSlide = useCallback(() => {
    setDirection(-1);
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1 || isPaused || !imagesReady) return;
    const timer = setInterval(nextSlide, 3500);
    return () => clearInterval(timer);
  }, [banners.length, isPaused, nextSlide, imagesReady]);

  const handleBannerClick = () => {
    const banner = banners[currentSlide];
    if (banner.redirectLink) {
      if (banner.redirectLink.startsWith('http')) {
        window.open(banner.redirectLink, '_blank');
      } else {
        navigate(banner.redirectLink);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = e.targetTouches[0].clientX;
    isSwiping.current = false;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    if (Math.abs(touchStartX.current - touchEndX.current) > 10) {
      isSwiping.current = true;
    }
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
  };

  if (loading || !imagesReady) {
    return (
      <section className="relative h-[340px] lg:h-[520px] flex items-center justify-center bg-muted">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-light tracking-wider">Loading</span>
        </div>
      </section>
    );
  }

  if (banners.length === 0) return null;

  return (
    <section
      className="relative overflow-hidden bg-background"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* ====== MOBILE LAYOUT ====== */}
      <div
        className="lg:hidden relative px-3 pt-1"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative w-full overflow-hidden rounded-2xl shadow-sm" style={{ aspectRatio: '4/5' }}>
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentSlide}
              custom={direction}
              initial={{ x: direction > 0 ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: direction > 0 ? "-100%" : "100%" }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute inset-0 cursor-pointer"
              style={{ willChange: 'transform' }}
              onClick={() => { if (!isSwiping.current) handleBannerClick(); }}
            >
              <img
                src={banners[currentSlide].imageUrl}
                alt="Banner"
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Dot Indicators */}
        {banners.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 py-3">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > currentSlide ? 1 : -1);
                  setCurrentSlide(index);
                }}
                className="p-0.5"
                aria-label={`Go to slide ${index + 1}`}
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? "w-6 h-[5px] bg-primary"
                      : "w-[5px] h-[5px] bg-muted"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ====== DESKTOP LAYOUT ====== */}
      <div className="hidden lg:block relative bg-background group pt-1">
        <div className="relative h-[440px] xl:h-[500px] 2xl:h-[560px] mx-4 overflow-hidden rounded-2xl">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentSlide}
              custom={direction}
              initial={{ x: direction > 0 ? "100%" : "-100%", scale: 1.02 }}
              animate={{ x: 0, scale: 1 }}
              exit={{ x: direction > 0 ? "-100%" : "100%", scale: 0.98 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 cursor-pointer"
              onClick={handleBannerClick}
            >
              <img
                src={banners[currentSlide].imageUrl}
                alt="Banner"
                className="w-full h-full object-cover"
                loading="eager"
              />
            </motion.div>
          </AnimatePresence>

          {/* Left Arrow */}
          {banners.length > 1 && (
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-background/80 dark:bg-card/80 backdrop-blur-sm hover:bg-background flex items-center justify-center shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-105"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5 text-foreground/80" />
            </button>
          )}

          {/* Right Arrow */}
          {banners.length > 1 && (
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-background/80 dark:bg-card/80 backdrop-blur-sm hover:bg-background flex items-center justify-center shadow-lg transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-105"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5 text-foreground/80" />
            </button>
          )}
        </div>

        {/* Dot Indicators */}
        {banners.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-5">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setDirection(index > currentSlide ? 1 : -1);
                  setCurrentSlide(index);
                }}
                className="group/dot p-1"
                aria-label={`Go to slide ${index + 1}`}
              >
                <span
                  className={`block rounded-full transition-all duration-400 ${
                    index === currentSlide
                      ? "w-8 h-2 bg-primary"
                      : "w-2 h-2 bg-muted-foreground/30 group-hover/dot:bg-muted-foreground/50"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroBanner;
