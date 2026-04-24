import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Star } from "lucide-react";
import avatar1 from "@/assets/avatars/avatar-1.jpg";
import avatar2 from "@/assets/avatars/avatar-2.jpg";
import avatar3 from "@/assets/avatars/avatar-3.jpg";
import { subscribeToTestimonials, Testimonial } from "@/services/testimonialService";

const AVATAR_MAP: Record<string, string> = {
  "avatar-1": avatar1,
  "avatar-2": avatar2,
  "avatar-3": avatar3,
  "real-1": "https://randomuser.me/api/portraits/women/44.jpg",
  "real-2": "https://randomuser.me/api/portraits/women/68.jpg",
  "real-3": "https://randomuser.me/api/portraits/men/32.jpg",
  "real-4": "https://randomuser.me/api/portraits/women/90.jpg",
  "real-5": "https://randomuser.me/api/portraits/men/75.jpg",
  "real-6": "https://randomuser.me/api/portraits/women/21.jpg",
  "anim-1": "https://api.dicebear.com/9.x/lorelei/svg?seed=Priya&backgroundColor=ffd5dc",
  "anim-2": "https://api.dicebear.com/9.x/lorelei/svg?seed=Ananya&backgroundColor=d1f4e0",
  "anim-3": "https://api.dicebear.com/9.x/lorelei/svg?seed=Ravi&backgroundColor=dbeafe",
  "anim-4": "https://api.dicebear.com/9.x/lorelei/svg?seed=Meera&backgroundColor=fef9c3",
  "anim-5": "https://api.dicebear.com/9.x/notionists/svg?seed=Diya&backgroundColor=ede9fe",
  "anim-6": "https://api.dicebear.com/9.x/notionists/svg?seed=Arjun&backgroundColor=fce7f3",
};

const resolveAvatar = (t: Testimonial): string => {
  if (t.avatarType === "avatar") return AVATAR_MAP[t.avatarUrl] || avatar1;
  return t.avatarUrl;
};

const CARD_WIDTH = 340;
const CARD_GAP = 24;

const TestimonialCard = ({ testimonial }: { testimonial: Testimonial }) => (
  <div
    className="relative overflow-hidden rounded-[28px] p-6 md:p-8 border border-[#d4af37]/15 bg-[linear-gradient(180deg,rgba(212,175,55,0.08)_0%,rgba(255,255,255,0)_35%),linear-gradient(135deg,rgba(131,39,41,0.04)_0%,rgba(255,255,255,0)_55%)] bg-card flex-shrink-0 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.5)] hover:shadow-[0_30px_80px_-44px_rgba(0,0,0,0.55)] transition-shadow duration-300"
    style={{ width: `${CARD_WIDTH}px` }}
  >
    <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />
    <div className="flex items-center gap-1 mb-4">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < testimonial.rating
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
    <h4 className="text-base font-semibold mb-3 text-foreground font-serif leading-snug">
      " {testimonial.title} "
    </h4>
    <p className="text-sm text-muted-foreground mb-6 leading-relaxed line-clamp-4 font-light">
      {testimonial.quote}
    </p>
    <div className="flex items-center gap-3 pt-4 border-t border-[#d4af37]/10">
      <img
        src={resolveAvatar(testimonial)}
        alt={testimonial.author}
        className="w-11 h-11 rounded-full object-cover ring-2 ring-[#d4af37]/20"
      />
      <div>
        <p className="font-medium text-sm text-foreground">{testimonial.author}</p>
        <p className="text-xs text-muted-foreground">{testimonial.role}</p>
      </div>
    </div>
  </div>
);

const TestimonialsCarousel = () => {
  const ref = useRef(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const animationRef = useRef<number>();
  const scrollPos = useRef(0);

  useEffect(() => {
    const unsub = subscribeToTestimonials((data) => {
      setTestimonials(data);
      setHasLoaded(true);
    }, true);
    return unsub;
  }, []);

  // JS-based smooth scroll animation for reliable marquee (only for 4+ testimonials)
  useEffect(() => {
    if (testimonials.length <= 3 || !scrollRef.current) return;

    const el = scrollRef.current;
    const singleSetWidth = testimonials.length * (CARD_WIDTH + CARD_GAP);
    const speed = 0.5; // pixels per frame

    const animate = () => {
      if (!isPaused) {
        scrollPos.current += speed;
        // Reset when we've scrolled past one full set (seamless loop with 3 copies)
        if (scrollPos.current >= singleSetWidth) {
          scrollPos.current = 0;
          el.style.transform = `translateX(0px)`;
        }
        el.style.transform = `translateX(-${scrollPos.current}px)`;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    // Reset position on testimonial data change
    scrollPos.current = 0;
    el.style.transform = `translateX(0px)`;

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [testimonials, isPaused]);

  const shouldAnimate = isInView || hasLoaded;
  const useMarquee = testimonials.length > 3;

  if (hasLoaded && testimonials.length === 0) return null;

  // Only duplicate for marquee mode (4+ items) - 3 copies for seamless loop
  const marqueeItems = useMarquee ? [...testimonials, ...testimonials, ...testimonials] : testimonials;

  return (
    <section ref={ref} className="py-14 md:py-20 bg-[linear-gradient(180deg,rgba(131,39,41,0.04)_0%,rgba(212,175,55,0.06)_100%)] overflow-hidden">
      {testimonials.length > 0 && (
        <>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-10 px-4"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="h-px w-8 bg-primary/50" />
              <span className="text-[10px] uppercase tracking-[0.32em] text-primary/80 font-medium">Testimonials</span>
              <span className="h-px w-8 bg-primary/50" />
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-2 font-serif">
              What Our Clients Say
            </h2>
            <p className="text-sm text-muted-foreground font-light">
              Hear from our happy customers across India
            </p>
          </motion.div>

          {useMarquee ? (
            /* Marquee Container - for 4+ testimonials */
            <div
              className="relative overflow-hidden"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
            >
              <div
                ref={scrollRef}
                className="flex will-change-transform"
                style={{ gap: `${CARD_GAP}px`, paddingLeft: `${CARD_GAP}px` }}
              >
                {marqueeItems.map((testimonial, index) => (
                  <TestimonialCard key={`t-${index}`} testimonial={testimonial} />
                ))}
              </div>
            </div>
          ) : (
            /* Static centered grid - for 1-3 testimonials */
            <div className="flex justify-center gap-6 px-4 flex-wrap">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.id || `t-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                >
                  <TestimonialCard testimonial={testimonial} />
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default TestimonialsCarousel;
