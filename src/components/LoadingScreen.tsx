import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import loadingImage from "@/assets/loading-screen.jpg";

interface LoadingScreenProps {
  onComplete?: () => void;
}

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [startAnimation, setStartAnimation] = useState(false);

  useEffect(() => {
    // Wait a moment before starting the door open animation
    const timer = setTimeout(() => {
      setStartAnimation(true);
    }, 1500);

    // Complete loading after animation
    const completeTimer = setTimeout(() => {
      setIsLoading(false);
      onComplete?.();
    }, 2800);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[9999] md:hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Background - white base */}
          <div className="absolute inset-0 bg-white" />

          {/* Centered Logo Image - stays in place */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 1 }}
            animate={startAnimation ? { opacity: 0, scale: 1.1 } : { opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <img
              src={loadingImage}
              alt="Loading"
              className="w-64 h-auto object-contain"
            />
          </motion.div>

          {/* Left Door - solid color */}
          <motion.div
            className="absolute top-0 left-0 w-1/2 h-full bg-white"
            initial={{ x: 0 }}
            animate={startAnimation ? { x: "-100%" } : { x: 0 }}
            transition={{
              duration: 1,
              ease: [0.76, 0, 0.24, 1],
            }}
          >
            {/* Door edge shadow */}
            <div className="absolute top-0 right-0 w-[3px] h-full bg-gradient-to-l from-black/10 to-transparent" />
          </motion.div>

          {/* Right Door - solid color */}
          <motion.div
            className="absolute top-0 right-0 w-1/2 h-full bg-white"
            initial={{ x: 0 }}
            animate={startAnimation ? { x: "100%" } : { x: 0 }}
            transition={{
              duration: 1,
              ease: [0.76, 0, 0.24, 1],
            }}
          >
            {/* Door edge shadow */}
            <div className="absolute top-0 left-0 w-[3px] h-full bg-gradient-to-r from-black/10 to-transparent" />
          </motion.div>

          {/* Center line where doors meet */}
          <motion.div
            className="absolute top-0 left-1/2 w-[1px] h-full bg-black/5 -translate-x-1/2"
            initial={{ opacity: 1 }}
            animate={startAnimation ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.2 }}
          />

          {/* Loading spinner at bottom */}
          <motion.div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
            initial={{ opacity: 1 }}
            animate={startAnimation ? { opacity: 0 } : { opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;
