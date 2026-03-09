import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";

const promos = [
  {
    id: 1,
    eyebrow: "LUXURY NECKLACE",
    title: "Best Friend Jewelry",
    subtitle: "A wide range of exquisite necklaces",
    cta: "Shop Now",
    image: "https://t3.ftcdn.net/jpg/00/83/61/32/360_F_83613230_H6tLsTMziCU2cY1QIJufVuBbZRYhyDf6.jpg",
    link: "/shop/necklaces",
  },
  {
    id: 2,
    eyebrow: "OUR EARRINGS",
    title: "Diamond Stud Earrings",
    subtitle: "A wide range of exquisite earrings",
    cta: "Shop Now",
    image: "https://img.freepik.com/premium-photo/elegant-silver-jewelry-with-detailed-design_1353959-17672.jpg?semt=ais_hybrid&w=740&q=80",
    link: "/shop/earrings",
  },
];

const PromoSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section ref={ref} className="w-full hidden lg:block">
      <div className="grid md:grid-cols-2">
        {promos.map((promo, index) => (
          <motion.div
            key={promo.id}
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: index * 0.15 }}
            className="group relative overflow-hidden"
          >
            {/* Background Image */}
            <div className="absolute inset-0">
              <img
                src={promo.image}
                alt={promo.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            
            {/* Content Overlay */}
            <div 
              className="relative z-10 p-8 md:p-12 lg:p-16 min-h-[400px] md:min-h-[450px] flex flex-col justify-center"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/80 block mb-3 font-semibold">
                {promo.eyebrow}
              </span>
              <p className="text-sm text-foreground/70 mb-5 max-w-[180px] leading-relaxed font-medium">
                {promo.subtitle}
              </p>
              <div>
                <Link
                  to={promo.link}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-foreground text-xs font-semibold tracking-wide rounded-full hover:bg-foreground hover:text-background transition-colors shadow-sm"
                >
                  {promo.cta}
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default PromoSection;
