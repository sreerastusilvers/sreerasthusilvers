import { Menu, Heart, ShoppingBag, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import darkLogo from "../assets/dark.png";
import whiteLogo from "../assets/white.png";
import { useTheme } from "@/contexts/ThemeContext";

const MobileHeader = () => {
  const navigate = useNavigate();
  const { totalItems, toggleCart } = useCart();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  return (
    <header className={`lg:hidden bg-background sticky top-0 z-50 transition-transform duration-300 border-b border-border ${
      isVisible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className="flex items-center justify-between px-3 py-2">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 hover:bg-muted rounded-full transition-colors"
            onClick={() => window.dispatchEvent(new Event('toggle-mobile-sidebar'))}
            aria-label="Menu"
          >
            <Menu className="w-[24px] h-[24px] text-foreground/80" strokeWidth={1.5} />
          </button>
          <a href="/" className="flex items-center">
            <img src={resolvedTheme === 'dark' ? darkLogo : whiteLogo} alt="Logo" className="h-10 w-auto object-contain" />
          </a>
        </div>

        {/* Right: Icons row */}
        <div className="flex items-center gap-1">
          {/* Grid/Store icon */}
          <button
            className="p-2 hover:bg-muted rounded-full transition-colors"
            onClick={() => navigate('/categories')}
            aria-label="Categories"
          >
            <LayoutGrid className="w-[22px] h-[22px] text-foreground/80" strokeWidth={1.5} />
          </button>

          {/* Wishlist */}
          <button
            className="p-2 hover:bg-muted rounded-full transition-colors"
            onClick={() => navigate('/wishlist')}
            aria-label="Wishlist"
          >
            <Heart className="w-[22px] h-[22px] text-foreground/80" strokeWidth={1.5} />
          </button>

          {/* Cart */}
          <button
            className="p-2 hover:bg-muted rounded-full transition-colors relative"
            onClick={toggleCart}
            aria-label="Cart"
          >
            <ShoppingBag className="w-[22px] h-[22px] text-foreground/80" strokeWidth={1.5} />
            {user && totalItems > 0 && (
              <span className="absolute top-0.5 right-0 min-w-[16px] h-[16px] bg-[#832729] text-white text-[9px] rounded-full flex items-center justify-center font-bold px-1">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default MobileHeader;
