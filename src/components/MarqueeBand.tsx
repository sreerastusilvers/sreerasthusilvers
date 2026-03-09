import { motion } from "framer-motion";
import { Sun } from "lucide-react";

const phrases = [
  "The Iconic Collection",
  "Color In Your Look",
  "Elegant And Everlasting",
  "Black Friday Offer",
  "Handcrafted Jewelry",
  "Timeless Beauty",
  "Premium Quality",
  "Exclusive Designs",
];

const MarqueeBand = () => {
  // Duplicate phrases for seamless loop
  const duplicatedPhrases = [...phrases, ...phrases, ...phrases];

  return (
    <section className="py-0 bg-black md:bg-background border-y border-border/30 overflow-hidden">
      <div className="relative">
        <motion.div
          className="flex items-center gap-8 whitespace-nowrap"
          animate={{
            x: [0, -100 * phrases.length],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 30,
              ease: "linear",
            },
          }}
        >
          {duplicatedPhrases.map((phrase, index) => (
            <div key={index} className="flex items-center gap-8">
              <span className="text-lg md:text-xl font-heading font-medium text-white md:text-foreground tracking-wide">
                {phrase}
              </span>
              <Sun className="w-5 h-5 text-white md:text-primary flex-shrink-0" />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default MarqueeBand;
