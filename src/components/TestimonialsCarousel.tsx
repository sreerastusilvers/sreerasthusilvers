import { useRef, useState, useEffect } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
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

const TestimonialsCarousel = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const unsub = subscribeToTestimonials((data) => {
      setTestimonials(data);
      setCurrentIndex(0);
      setHasLoaded(true);
    }, true);
    return unsub;
  }, []);

  // Always animate in once data is loaded and in view (or already was in view)
  const shouldAnimate = isInView || hasLoaded;

  const next = () => setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  if (hasLoaded && testimonials.length === 0) return null;

  return (
    <section ref={ref} className="py-16 md:py-20 bg-white">
      {testimonials.length > 0 && (
      <div className="container-custom">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-3" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            What Our Clients Say
          </h2>
          <p className="text-base text-muted-foreground">
            Adorn Yourself in Glamour: Find Your Perfect Piece Today
          </p>
        </motion.div>

        {/* Testimonials Grid - Desktop */}
        <div className="hidden lg:grid grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id || index}
              initial={{ opacity: 0, y: 30 }}
              animate={shouldAnimate ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-md border border-border/30"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {/* Rating */}
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < testimonial.rating
                        ? "fill-orange-400 text-orange-400"
                        : "fill-muted text-muted"
                    }`}
                  />
                ))}
              </div>

              {/* Title */}
              <h4 className="text-lg font-semibold mb-4 text-foreground">
                " {testimonial.title} "
              </h4>

              {/* Quote */}
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                {testimonial.quote}
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <img
                  src={resolveAvatar(testimonial)}
                  alt={testimonial.author}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-sm text-foreground">{testimonial.author}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Testimonials Carousel - Mobile */}
        <div className="lg:hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-2xl p-6 shadow-md border border-border/30"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {/* Rating */}
              <div className="flex items-center gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < testimonials[currentIndex].rating ? 'fill-orange-400 text-orange-400' : 'fill-muted text-muted'}`} />
                ))}
              </div>
              <h4 className="text-lg font-semibold mb-3 text-foreground">
                " {testimonials[currentIndex].title} "
              </h4>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                {testimonials[currentIndex].quote}
              </p>
              <div className="flex items-center gap-3">
                <img
                  src={resolveAvatar(testimonials[currentIndex])}
                  alt={testimonials[currentIndex].author}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-semibold text-sm text-foreground">{testimonials[currentIndex].author}</p>
                  <p className="text-xs text-muted-foreground">{testimonials[currentIndex].role}</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Mobile Navigation */}
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={prev}
              className="p-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex ? "bg-primary w-6" : "bg-muted-foreground/30"
                  }`}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="p-2 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
      )}
    </section>
  );
};

export default TestimonialsCarousel;
