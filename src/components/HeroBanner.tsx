import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
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

  // Real-time subscription to active banners
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

  // Preload ALL banner images when banners are loaded
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
        if (loadedCount >= totalImages) {
          setImagesReady(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount >= totalImages) {
          setImagesReady(true);
        }
      };
      img.src = banner.imageUrl;
    });
    
    // Fallback: show images after 3s even if not all loaded
    const fallbackTimer = setTimeout(() => {
      setImagesReady(true);
    }, 3000);
    
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

  // Auto-play carousel - only start when images are ready
  useEffect(() => {
    if (banners.length <= 1 || isPaused || !imagesReady) return;
    const timer = setInterval(nextSlide, 3500);
    return () => clearInterval(timer);
  }, [banners.length, isPaused, nextSlide, imagesReady]);

  const handleBannerClick = (index: number) => {
    if (index === currentSlide) {
      const banner = banners[index];
      // Only navigate if redirectLink exists
      if (banner.redirectLink) {
        if (banner.redirectLink.startsWith('http')) {
          window.open(banner.redirectLink, '_blank');
        } else {
          navigate(banner.redirectLink);
        }
      }
    } else {
      setCurrentSlide(index);
    }
  };

  // Touch/swipe handling
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

  const getSlideIndex = (offset: number) => {
    return (currentSlide + offset + banners.length) % banners.length;
  };

  if (loading || !imagesReady) {
    return (
      <section className="relative h-[220px] lg:h-[420px] flex items-center justify-center bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </section>
    );  }

  if (banners.length === 0) return null;

  return (
    <section
      className="relative overflow-hidden"
      style={{ 
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)'
      }}
    >
      {/* ====== MOBILE LAYOUT - Tanishq Style ====== */}
      <div
        className="lg:hidden relative pt-4 pb-2"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Hidden preload: render ALL images offscreen so browser decodes them once */}
        <div className="absolute w-0 h-0 overflow-hidden" aria-hidden="true">
          {banners.map((banner, i) => (
            <img key={i} src={banner.imageUrl} alt="" />
          ))}
        </div>

        {/* Banner Container with side peeks */}
        <div className="relative w-full overflow-hidden" style={{ height: "clamp(270px, 85vw, 400px)", transform: 'translateZ(0)' }}>
          {/* Render ALL slides, position them via translateX */}
          {banners.map((banner, index) => {
            // Calculate offset from current slide
            let offset = index - currentSlide;
            // Handle wrapping
            if (offset > banners.length / 2) offset -= banners.length;
            if (offset < -banners.length / 2) offset += banners.length;
            
            const isVisible = Math.abs(offset) <= 1;
            
            return (
              <motion.div
                key={index}
                animate={{ 
                  x: `${offset * 100}%`,
                }}
                transition={{ 
                  duration: 0.4,
                  ease: "easeOut"
                }}
                className="absolute inset-0 flex items-center"
                style={{ 
                  willChange: 'transform',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  visibility: isVisible ? 'visible' : 'hidden',
                }}
                drag={index === currentSlide ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={(_, info) => {
                  isSwiping.current = true;
                  if (info.offset.x > 50) {
                    prevSlide();
                  } else if (info.offset.x < -50) {
                    nextSlide();
                  }
                }}
                onTap={() => {
                  // Only trigger navigation when tapping (not swiping) current slide
                  if (index === currentSlide && !isSwiping.current) {
                    handleBannerClick(index);
                  }
                }}
              >
                {/* Previous slide peek (left edge) */}
                {banners.length > 1 && (
                  <div
                    className="absolute left-0 top-0 h-full w-[12px] cursor-pointer overflow-hidden rounded-r-lg"
                    onClick={prevSlide}
                  >
                    <img
                      src={banners[getSlideIndex(index - currentSlide - 1)].imageUrl}
                      alt=""
                      className="h-full w-[95vw] object-cover object-right"
                      loading="eager"
                      style={{ transform: 'translate3d(0, 0, 0)' }}
                    />
                  </div>
                )}

                {/* Main slide */}
                <div
                  className="absolute inset-0 mx-[16px] cursor-pointer rounded-xl overflow-hidden bg-gray-100"
                  style={{
                    transform: 'translate3d(0, 0, 0)',
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden'
                  }}
                >
                  <img
                    src={banner.imageUrl}
                    alt="Banner"
                    className="w-full h-full object-cover pointer-events-none"
                    loading="eager"
                    decoding="async"
                    style={{
                      transform: 'translate3d(0, 0, 0)',
                    }}
                  />
                </div>

                {/* Next slide peek (right edge) */}
                {banners.length > 1 && (
                  <div
                    className="absolute right-0 top-0 h-full w-[12px] cursor-pointer overflow-hidden rounded-l-lg"
                    onClick={nextSlide}
                  >
                    <img
                      src={banners[getSlideIndex(index - currentSlide + 1)].imageUrl}
                      alt=""
                      className="h-full w-[95vw] object-cover object-left"
                      loading="eager"
                      style={{ transform: 'translate3d(0, 0, 0)' }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Dot Indicators - Below the banner */}
        {banners.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8 pb-4">
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
                {index === currentSlide ? (
                  <span className="block w-[10px] h-[10px] rotate-45 bg-[#832729] border border-[#832729]" />
                ) : (
                  <span className="block w-[8px] h-[8px] rounded-full bg-gray-300" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ====== DESKTOP LAYOUT - Tanishq Style ====== */}
      <div className="hidden lg:block relative pt-8 pb-6">
        <div className="relative h-[380px] xl:h-[420px] 2xl:h-[450px] w-full overflow-hidden">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={currentSlide}
              custom={direction}
              initial={{ x: direction > 0 ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: direction > 0 ? "-100%" : "100%" }}
              transition={{ 
                duration: 0.8,
                ease: [0.32, 0.72, 0, 1]
              }}
              className="absolute inset-0 flex items-center justify-center"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100) {
                  prevSlide();
                } else if (info.offset.x < -100) {
                  nextSlide();
                }
              }}
            >
              {/* Previous slide peek - Left side */}
              {banners.length > 1 && (
                <motion.div
                  className="absolute left-0 top-0 h-full cursor-pointer"
                  style={{ width: "80px" }}
                  onClick={prevSlide}
                  whileHover={{ opacity: 0.7 }}
                >
                  <div className="h-full w-full overflow-hidden rounded-r-2xl">
                    <img
                      src={banners[getSlideIndex(-1)].imageUrl}
                      alt=""
                      className="h-full w-[1400px] object-cover object-right"
                    />
                  </div>
                </motion.div>
              )}

              {/* Main Center Slide */}
              <div className="relative h-full flex-1 mx-[140px]">
                <div
                  className="absolute inset-0 cursor-grab active:cursor-grabbing rounded-3xl overflow-hidden shadow-lg"
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest('[data-dragging]')) {
                      handleBannerClick(currentSlide);
                    }
                  }}
                >
                  <img
                    src={banners[currentSlide].imageUrl}
                    alt="Banner"
                    className="w-full h-full object-cover pointer-events-none"
                    loading="eager"
                  />
                </div>
              </div>

              {/* Next slide peek - Right side */}
              {banners.length > 1 && (
                <motion.div
                  className="absolute right-0 top-0 h-full cursor-pointer"
                  style={{ width: "80px" }}
                  onClick={nextSlide}
                  whileHover={{ opacity: 0.7 }}
                >
                  <div className="h-full w-full overflow-hidden rounded-l-2xl">
                    <img
                      src={banners[getSlideIndex(1)].imageUrl}
                      alt=""
                      className="h-full w-[1400px] object-cover object-left"
                    />
                  </div>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Diamond Dot Indicators - Desktop - Outside banner */}
        {banners.length > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className="p-1 group"
                aria-label={`Go to slide ${index + 1}`}
              >
                <span
                  className={`block w-2.5 h-2.5 rotate-45 transition-all duration-300 border ${
                    index === currentSlide
                      ? "bg-[#832729] border-[#832729] scale-110"
                      : "bg-transparent border-[#832729]/40 group-hover:border-[#832729]/70 group-hover:bg-[#832729]/20"
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
