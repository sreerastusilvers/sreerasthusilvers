import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import collectionBanner from "@/assets/collection-banner.jpg";

const CollectionBanner = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section ref={ref} className="w-full">
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.8 }}
        className="relative overflow-hidden"
      >
        <img
          src={collectionBanner}
          alt="Sreerasthu Silvers Collection"
          className="w-full h-[350px] md:h-[450px] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/60 to-transparent" />
        <div className="absolute inset-0 flex items-center">
          <div className="container-custom">
            <div className="max-w-lg text-primary-foreground" style={{ fontFamily: "'Poppins', sans-serif" }}>
              <span className="text-xs uppercase tracking-[0.2em] text-white/80 block mb-3 font-medium">SREERASTHU SILVERS COLLECTION</span>
              <h2 className="text-xl md:text-2xl font-semibold mb-4 text-white whitespace-nowrap" style={{ fontFamily: "'Montserrat', sans-serif" }}>Shop The Latest Jewllery</h2>
              <p className="text-sm md:text-base text-white/80 mb-6">
                Exceptional Handcrafted Design to Enhance the Magnificent Glow
              </p>
              <Link 
                to="/jewelry" 
                className="inline-flex items-center px-8 py-3.5 bg-white text-foreground text-xs font-semibold tracking-wide rounded-full hover:bg-foreground hover:text-white transition-colors"
              >
                Shop Now
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default CollectionBanner;
