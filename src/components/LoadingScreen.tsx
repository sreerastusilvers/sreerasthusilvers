import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";

interface LoadingScreenProps {
  onComplete?: () => void;
}

const LoadingScreen = ({ onComplete }: LoadingScreenProps) => {
  const { resolvedTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [phase, setPhase] = useState<"enter" | "shimmer" | "exit">("enter");

  const logoSrc = resolvedTheme === "dark" ? "/white_logo.png" : "/black_logo.png";

  useEffect(() => {
    // Phase: logo animates in (0–700ms)
    // Phase: shimmer plays (700ms–2100ms)
    const shimmerTimer = setTimeout(() => setPhase("shimmer"), 700);
    // Phase: exit fade (2100–2800ms)
    const exitTimer = setTimeout(() => setPhase("exit"), 2100);
    const completeTimer = setTimeout(() => {
      setIsLoading(false);
      onComplete?.();
    }, 2800);

    return () => {
      clearTimeout(shimmerTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[9999] md:hidden flex items-center justify-center"
          style={{ background: resolvedTheme === "dark" ? "#0d0c0b" : "#ffffff" }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Subtle radial glow behind logo */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                resolvedTheme === "dark"
                  ? "radial-gradient(ellipse 55% 40% at 50% 50%, rgba(212,175,55,0.08) 0%, transparent 70%)"
                  : "radial-gradient(ellipse 55% 40% at 50% 50%, rgba(212,175,55,0.06) 0%, transparent 70%)",
            }}
          />

          {/* Logo container */}
          <motion.div
            className="relative flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.88, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <img
              src={logoSrc}
              alt="Sreerasthu Silvers"
              className="w-52 h-auto object-contain select-none"
              draggable={false}
            />

            {/* Shimmer sweep */}
            <AnimatePresence>
              {phase === "shimmer" && (
                <motion.div
                  className="absolute inset-0 overflow-hidden pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="absolute inset-y-0 w-16"
                    style={{
                      background:
                        resolvedTheme === "dark"
                          ? "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)"
                          : "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)",
                      left: "-4rem",
                    }}
                    animate={{ left: ["−4rem", "calc(100% + 4rem)"] }}
                    transition={{ duration: 1.1, ease: "easeInOut", delay: 0.1 }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bottom pulse dots */}
          <motion.div
            className="absolute bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "exit" ? 0 : 1 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block w-1.5 h-1.5 rounded-full"
                style={{
                  background: resolvedTheme === "dark" ? "rgba(212,175,55,0.6)" : "rgba(180,140,30,0.45)",
                }}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;

