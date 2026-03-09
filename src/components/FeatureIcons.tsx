import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Package, Headphones, CalendarCheck, Gift } from "lucide-react";

const features = [
  {
    id: 1,
    title: "Complimentary Shipping",
    description: "We offer complimentary shipping and returns on all orders over ₹10,000.",
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
    description: "We're happy to help with in-store or virtual appointments.",
    icon: CalendarCheck,
  },
  {
    id: 4,
    title: "The Iconic Box",
    description: "Your Sreerasthu purchase comes wrapped in our Box packaging.",
    icon: Gift,
  },
];

const FeatureIcons = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section ref={ref} className="hidden md:block py-8 md:py-10 bg-white border-y border-border/20">
      <div className="container-custom">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex flex-col items-center text-center lg:flex-row lg:items-start lg:text-left gap-3 lg:gap-4"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                <feature.icon className="w-10 h-10 text-foreground" strokeWidth={1} />
              </div>

              {/* Content */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  {feature.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
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
