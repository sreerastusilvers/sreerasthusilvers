import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import collectionBanner from "@/assets/collection-banner.jpg";

const CollectionBanner = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <section ref={ref} className="w-full py-6 md:py-10">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8 }}
          className="relative overflow-hidden rounded-2xl"
        >
          <img
            src={collectionBanner}
            alt="Sreerasthu Silvers Collection"
            className="w-full h-[300px] md:h-[420px] object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="px-8 md:px-14">
              <div className="max-w-lg">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/60 block mb-3 font-medium">SREERASTHU SILVERS COLLECTION</span>
                <h2 className="text-xl md:text-3xl font-semibold mb-3 text-white font-serif">Shop The Latest Jewellery</h2>
                <p className="text-sm text-white/70 mb-6 font-light max-w-sm">
                  Exceptional Handcrafted Design to Enhance the Magnificent Glow
                </p>
                <Link 
                  to="/jewelry" 
                  className="inline-flex items-center px-7 py-3 bg-white text-gray-900 text-xs font-semibold tracking-wide rounded-full hover:bg-primary hover:text-white transition-colors"
                >
                  Shop Now
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CollectionBanner;
