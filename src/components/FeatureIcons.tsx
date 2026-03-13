import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Package, Headphones, CalendarCheck, Gift } from "lucide-react";

const features = [
  {
    id: 1,
    title: "Complimentary Shipping",
    description: "Free shipping & returns on orders over ₹10,000.",
    icon: Package,
  },
  {
    id: 2,
    title: "Sreerasthu At Your Service",
    description: "Our client care experts are always here to help.",
    icon: Headphones,
  },
  {
    id: 3,
    title: "Book an Appointment",
    description: "In-store or virtual appointments available.",
    icon: CalendarCheck,
  },
  {
    id: 4,
    title: "The Iconic Box",
    description: "Every purchase wrapped in our signature packaging.",
    icon: Gift,
  },
];

const FeatureIcons = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section ref={ref} className="hidden md:block py-10 bg-background border-y border-border">
      <div className="container-custom">
        <div className="grid grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 15 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="flex flex-col items-center text-center gap-3"
            >
              {/* Icon */}
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/10 flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>

              {/* Content */}
              <div>
                <h4 className="text-[13px] font-semibold text-foreground leading-tight mb-1">
                  {feature.title}
                </h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureIcons;
