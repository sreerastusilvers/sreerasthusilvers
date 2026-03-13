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
    <section ref={ref} className="w-full hidden lg:block py-10">
      <div className="container-custom">
        <div className="grid md:grid-cols-2 gap-6">
          {promos.map((promo, index) => (
            <motion.div
              key={promo.id}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="group relative overflow-hidden rounded-2xl"
            >
              {/* Background Image */}
              <div className="absolute inset-0">
                <img
                  src={promo.image}
                  alt={promo.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              </div>
              
              {/* Content Overlay */}
              <div className="relative z-10 p-10 lg:p-14 min-h-[380px] flex flex-col justify-end">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/70 block mb-2 font-medium">
                  {promo.eyebrow}
                </span>
                <h3 className="text-xl font-semibold text-white mb-2 font-serif">
                  {promo.title}
                </h3>
                <p className="text-sm text-white/70 mb-5 max-w-[220px] leading-relaxed font-light">
                  {promo.subtitle}
                </p>
                <div>
                  <Link
                    to={promo.link}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-gray-900 text-xs font-semibold tracking-wide rounded-full hover:bg-primary hover:text-white transition-colors"
                  >
                    {promo.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PromoSection;
