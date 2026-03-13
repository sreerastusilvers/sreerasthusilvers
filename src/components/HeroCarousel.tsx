import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import heroMain from "@/assets/hero-main.jpg";
import heroShineBright from "@/assets/hero-shine-bright.jpg";
import collectionBanner from "@/assets/collection-banner.jpg";
import heroPearlNecklace from "@/assets/hero-pearl-necklace.png";

const slides = [
  {
    id: 1,
    eyebrow: "OUR EARRINGS",
    title: "Find the Perfect Ring",
    subtitle: "Discover our exquisite collection of handcrafted silver jewelry",
    cta: "Shop Now",
    image: heroMain,
  },
  {
    id: 2,
    eyebrow: "STUNNING EARRINGS",
    title: "Shine Bright",
    subtitle: "Statement earrings for every occasion",
    cta: "Shop Earrings",
    image: heroShineBright,
  },
  {
    id: 3,
    eyebrow: "ELEGANT PEARLS",
    title: "Timeless Elegance",
    subtitle: "Discover our exquisite pearl jewelry collection",
    cta: "Shop Pearls",
    image: heroPearlNecklace,
  },
  {
    id: 4,
    eyebrow: "EXCLUSIVE OFFER",
    title: "Up to 30% Off",
    subtitle: "Grab the deal right now! Extra 15% off this season.",
    cta: "Shop Sale",
    image: collectionBanner,
  },
];

const HeroCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextSlide, 3000);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  return (
    <section
      className="relative min-h-screen w-full overflow-hidden bg-foreground/10"
    >
      {/* Background Images - All slides rendered, only current one visible */}
      {slides.map((slide, index) => (
        <motion.div
          key={slide.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: index === currentSlide ? 1 : 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0 w-full h-full"
        >
          {/* Background Image with Parallax - Full width no gaps */}
          <motion.div
            className="absolute inset-0 w-full h-full parallax-slow"
            initial={{ scale: 1.05 }}
            animate={{ scale: index === currentSlide ? 1 : 1.05 }}
            transition={{ duration: 1.2 }}
          >
            <img
              src={slide.image}
              alt="Luxury jewelry collection"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent" />
          </motion.div>
        </motion.div>
      ))}

      {/* Content */}
      <div className="relative z-10 px-4 md:px-8 lg:px-16 h-full min-h-screen flex items-center">
        <div className="max-w-2xl py-16 lg:py-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5, staggerChildren: 0.1 }}
            >
              {/* Eyebrow */}
              <motion.span
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="eyebrow block mb-4"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {slides[currentSlide].eyebrow}
              </motion.span>

              {/* Title */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="heading-xl mb-6"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {slides[currentSlide].title.split(" ").map((word, i) => (
                  <span key={i} className="inline-block mr-4">
                    {word}
                  </span>
                ))}
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="body-lg mb-8 max-w-md"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                {slides[currentSlide].subtitle}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap gap-4"
              >
                <a href="#shop" className="btn-primary">
                  {slides[currentSlide].cta}
                </a>
                <a href="#collection" className="btn-outline-gold">
                  View Collection
                </a>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute left-2 md:left-4 lg:left-8 top-1/2 -translate-y-1/2 z-30 p-3 md:p-4 bg-background/95 dark:bg-card/95 backdrop-blur-sm rounded-full shadow-2xl hover:bg-background transition-all hover:scale-110 border-2 border-border"
        aria-label="Previous slide"
      >
        <ChevronLeft className="w-6 h-6 md:w-7 md:h-7 text-foreground stroke-[3]" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-2 md:right-4 lg:right-8 top-1/2 -translate-y-1/2 z-30 p-3 md:p-4 bg-background/95 dark:bg-card/95 backdrop-blur-sm rounded-full shadow-2xl hover:bg-background transition-all hover:scale-110 border-2 border-border"
        aria-label="Next slide"
      >
        <ChevronRight className="w-6 h-6 md:w-7 md:h-7 text-foreground stroke-[3]" />
      </button>

      {/* Dots Navigation */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-3 rounded-full transition-all focus-gold shadow-md ${
              index === currentSlide
                ? "bg-primary w-8"
                : "bg-white/70 hover:bg-white/90 w-3"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
};

export default HeroCarousel;
