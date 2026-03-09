import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { subscribeToShowcases, Showcase } from "@/services/showcaseService";
import { Loader2 } from "lucide-react";

const CategoryShowcase = () => {
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to active showcases only
    const unsubscribe = subscribeToShowcases((data) => {
      setShowcases(data);
      setLoading(false);
    }, true); // true = active only

    return () => unsubscribe();
  }, []);

  const handleCardClick = (id: string) => {
    // On mobile, toggle the active state
    setActiveCard(activeCard === id ? null : id);
  };

  // Build category link from subtitle (e.g., "RINGS" -> "/shop/rings")
  const getCategoryLink = (subtitle: string): string => {
    const category = subtitle.toLowerCase().trim();
    return `/shop/${category}`;
  };

  // Show loading state while data is being fetched
  if (loading) {
    return (
      <section className="w-full py-20">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  // Don't render if no showcases
  if (showcases.length === 0) {
    return null;
  }

  return (
    <section className="w-full">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {showcases.map((showcase, index) => (
          <motion.div
            key={showcase.id}
            className={`relative group overflow-hidden ${activeCard === showcase.id ? 'active' : ''}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Link 
              to={getCategoryLink(showcase.subtitle)}
              className="block cursor-pointer"
              onClick={() => handleCardClick(showcase.id!)}
            >
              {/* Background Image */}
              <div className="aspect-[4/5] relative">
                <img
                  src={showcase.imageUrl}
                  alt={showcase.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 lg:group-hover:scale-105"
                />
                
                {/* Gradient Overlay - darker on hover/active */}
                <div className={`absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent transition-all duration-300 ${activeCard === showcase.id ? 'lg:from-black/70 lg:via-black/40' : ''} lg:group-hover:from-black/70 lg:group-hover:via-black/40`} />
                
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end items-center p-4 text-white text-center pointer-events-none">
                  {/* Title - always visible at bottom */}
                  <h3 
                    className="text-base md:text-xl font-medium mb-1 transition-all duration-300"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    {showcase.title}
                  </h3>
                  
                  {/* Subtitle/Product name - always visible */}
                  <p className={`text-xs uppercase tracking-[0.2em] text-white/80 transition-all duration-300 ${activeCard === showcase.id ? 'mb-2' : 'mb-0 lg:group-hover:mb-2'}`}>
                    {showcase.subtitle}
                  </p>
                  
                  {/* Description - hidden by default, visible on tap (mobile) or hover (desktop) */}
                  <p className={`text-xs text-white/80 leading-relaxed overflow-hidden transition-all duration-300 ${activeCard === showcase.id ? 'max-h-16 opacity-100 mb-3' : 'max-h-0 opacity-0 lg:group-hover:max-h-16 lg:group-hover:opacity-100 lg:group-hover:mb-3'}`}>
                    {showcase.description}
                  </p>
                  
                  {/* CTA - hidden by default, visible on tap (mobile) or hover (desktop) */}
                  <span 
                    className={`inline-block text-xs font-medium border-b border-white pb-1 hover:border-primary hover:text-primary overflow-hidden transition-all duration-300 ${activeCard === showcase.id ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0 lg:group-hover:max-h-10 lg:group-hover:opacity-100'}`}
                  >
                    {showcase.cta}
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default CategoryShowcase;
