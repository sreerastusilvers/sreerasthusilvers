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
    <section className="w-full py-6 md:py-14">
      <div className="container-custom">
        {/* Section Title */}
        <div className="text-center mb-6 md:mb-10">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Our Collections
          </h2>
          <p className="text-sm text-muted-foreground mt-2 font-light">Explore curated collections crafted with passion</p>
        </div>
        
        {/* Bento Grid: 1 large left + 2 stacked right */}
        <div className="grid grid-cols-2 gap-2 md:gap-5" style={{ gridTemplateRows: 'repeat(2, 1fr)' }}>
          {showcases.map((showcase, index) => {
            const isFirst = index === 0;
            return (
              <motion.div
                key={showcase.id}
                className={`relative group overflow-hidden rounded-2xl md:rounded-3xl ${
                  isFirst ? 'row-span-2' : ''
                } ${activeCard === showcase.id ? 'active' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Link 
                  to={getCategoryLink(showcase.subtitle)}
                  className="block cursor-pointer h-full"
                  onClick={() => handleCardClick(showcase.id!)}
                >
                  <div className={`relative h-full ${isFirst ? 'min-h-[400px] md:min-h-[520px]' : 'min-h-[195px] md:min-h-[252px]'}`}>
                    <img
                      src={showcase.imageUrl}
                      alt={showcase.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 lg:group-hover:scale-105"
                    />
                    
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent transition-all duration-300 lg:group-hover:from-black/70`} />
                    
                    {/* Content */}
                    <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-8 text-white">
                      <h3 
                        className={`font-semibold mb-0.5 transition-all duration-300 ${isFirst ? 'text-xl md:text-3xl' : 'text-base md:text-xl'}`}
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        {showcase.title}
                      </h3>
                      
                      <p className={`uppercase tracking-[0.2em] text-white/70 font-light ${isFirst ? 'text-[10px] md:text-xs' : 'text-[9px] md:text-[11px]'}`}>
                        {showcase.subtitle}
                      </p>
                      
                      {/* Description - on hover/tap */}
                      <p className={`text-xs text-white/80 leading-relaxed overflow-hidden transition-all duration-300 ${
                        activeCard === showcase.id 
                          ? 'max-h-16 opacity-100 mt-2' 
                          : 'max-h-0 opacity-0 lg:group-hover:max-h-16 lg:group-hover:opacity-100 lg:group-hover:mt-3'
                      }`}>
                        {showcase.description}
                      </p>

                      {/* Shop button on hover */}
                      <div className={`overflow-hidden transition-all duration-300 ${
                        activeCard === showcase.id 
                          ? 'max-h-12 opacity-100 mt-3' 
                          : 'max-h-0 opacity-0 lg:group-hover:max-h-12 lg:group-hover:opacity-100 lg:group-hover:mt-4'
                      }`}>
                        <span className="inline-block px-5 py-2 bg-white text-gray-900 rounded-full text-xs font-medium">
                          Shop Now
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategoryShowcase;
