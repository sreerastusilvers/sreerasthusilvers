import { Search, Gift, Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

const MobileSearchBar = () => {
  const navigate = useNavigate();
  
  const categories = [
    "silver jewellery",
    "rings",
    "necklaces",
    "earrings",
    "bracelets",
    "pendants",
    "chains",
    "anklets",
    "silver coins",
    "gift articles"
  ];
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const handleVoiceSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice search is not supported in your browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      navigate(`/search?q=${encodeURIComponent(transcript)}`);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  const handleCancelVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
      setIsListening(false);
      recognitionRef.current = null;
    }
  };
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % categories.length);
    }, 2500);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="lg:hidden bg-background px-4 pt-1 pb-2 z-40">
      <div className="w-full relative flex items-center bg-muted rounded-full overflow-hidden h-[46px]">
        {/* "Speak now..." overlay when listening */}
        {isListening && (
          <div 
            onClick={handleCancelVoice}
            className="absolute inset-0 bg-red-50 flex items-center justify-center z-10 cursor-pointer"
          >
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-red-500 animate-pulse" strokeWidth={2} />
                <span className="text-sm font-medium text-red-500">Speak now...</span>
              </div>
              <span className="text-xs text-red-400">Tap to stop</span>
            </div>
          </div>
        )}
        
        {/* Search Icon */}
        <button 
          onClick={() => navigate("/search")}
          className="pl-4 pr-2 flex items-center h-full flex-1"
        >
          <Search className="w-[22px] h-[22px] text-foreground/80" strokeWidth={1} />
        
          {/* Placeholder Text */}
          <div className="flex-1 text-[14px] text-muted-foreground text-left flex items-center overflow-hidden ml-2">
            <span className="mr-1 whitespace-nowrap">Search for</span>
            <div className="relative min-w-[120px] h-[20px]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentIndex}
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 20, opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute left-0 top-0 whitespace-nowrap"
                >
                  {categories[currentIndex]}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </button>
        
        {/* Right Icons: Gift + Mic */}
        <div className="flex items-center gap-0 pr-3">
          <button 
            onClick={() => navigate('/articles/gift-articles')}
            className="p-1 hover:bg-muted rounded-full transition-colors" 
            aria-label="Gift articles"
          >
            <Gift className="w-[22px] h-[22px] text-foreground/80" strokeWidth={1} />
          </button>
          <div className="w-px h-5 bg-border" />
          <button 
            onClick={handleVoiceSearch}
            className={`p-1 hover:bg-muted rounded-full transition-colors ${
              isListening ? 'bg-red-50 dark:bg-red-900/20' : ''
            }`}
          >
            <Mic className={`w-[22px] h-[22px] ${isListening ? 'text-red-500' : 'text-foreground/80'}`} strokeWidth={1} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileSearchBar;
