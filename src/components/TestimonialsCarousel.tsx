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
    className="bg-card rounded-2xl p-6 md:p-8 shadow-sm border border-border flex-shrink-0 hover:shadow-md transition-shadow duration-300"
    style={{ width: `${CARD_WIDTH}px` }}
  >
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
    <h4 className="text-base font-semibold mb-3 text-foreground font-serif">
      " {testimonial.title} "
    </h4>
    <p className="text-sm text-muted-foreground mb-6 leading-relaxed line-clamp-3 font-light">
      {testimonial.quote}
    </p>
    <div className="flex items-center gap-3 pt-4 border-t border-border">
      <img
        src={resolveAvatar(testimonial)}
        alt={testimonial.author}
        className="w-10 h-10 rounded-full object-cover ring-2 ring-[#832729]/10"
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

  // JS-based smooth scroll animation for reliable marquee
  useEffect(() => {
    if (testimonials.length === 0 || !scrollRef.current) return;

    const el = scrollRef.current;
    const singleSetWidth = testimonials.length * (CARD_WIDTH + CARD_GAP);
    const speed = 0.5; // pixels per frame

    const animate = () => {
      if (!isPaused) {
        scrollPos.current += speed;
        if (scrollPos.current >= singleSetWidth) {
          scrollPos.current -= singleSetWidth;
        }
        el.style.transform = `translateX(-${scrollPos.current}px)`;
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [testimonials, isPaused]);

  const shouldAnimate = isInView || hasLoaded;

  if (hasLoaded && testimonials.length === 0) return null;

  // Triple the items for seamless looping
  const marqueeItems = [...testimonials, ...testimonials, ...testimonials];

  return (
    <section ref={ref} className="py-14 md:py-20 bg-secondary/50 dark:bg-muted overflow-hidden">
      {testimonials.length > 0 && (
        <>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-10 px-4"
          >
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-2 font-serif">
              What Our Clients Say
            </h2>
            <p className="text-sm text-muted-foreground font-light">
              Hear from our happy customers across India
            </p>
          </motion.div>

          {/* Marquee Container */}
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
        </>
      )}
    </section>
  );
};

export default TestimonialsCarousel;
