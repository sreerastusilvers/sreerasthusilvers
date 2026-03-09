import { Menu, Heart, ShoppingBag, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import logo from "../assets/mobile-logo.png";

const MobileHeader = () => {
  const navigate = useNavigate();
  const { totalItems, toggleCart } = useCart();
  const { user } = useAuth();
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
    <header className={`lg:hidden bg-white sticky top-0 z-50 transition-transform duration-300 ${
      isVisible ? 'translate-y-0' : '-translate-y-full'
    }`}>
      <div className="flex items-center justify-between px-3 py-2">
        {/* Left: Hamburger + Logo */}
        <div className="flex items-center gap-2">
          <button
            className="p-1.5 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => window.dispatchEvent(new Event('toggle-mobile-sidebar'))}
            aria-label="Menu"
          >
            <Menu className="w-[26px] h-[26px]" strokeWidth={1} style={{ color: '#832729' }} />
          </button>
          <a href="/" className="flex items-center">
            <img src={logo} alt="Logo" className="h-10 w-auto object-contain" />
          </a>
        </div>

        {/* Right: Icons row */}
        <div className="flex items-center gap-0">
          {/* Grid/Store icon */}
          <button
            className="p-1.5 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigate('/categories')}
            aria-label="Categories"
          >
            <LayoutGrid className="w-[24px] h-[24px]" strokeWidth={1} style={{ color: '#832729' }} />
          </button>

          {/* Wishlist */}
          <button
            className="p-1.5 hover:bg-gray-50 rounded-full transition-colors"
            onClick={() => navigate('/wishlist')}
            aria-label="Wishlist"
          >
            <Heart className="w-[24px] h-[24px]" strokeWidth={1} style={{ color: '#832729' }} />
          </button>

          {/* Cart */}
          <button
            className="p-1.5 hover:bg-gray-50 rounded-full transition-colors relative"
            onClick={toggleCart}
            aria-label="Cart"
          >
            <ShoppingBag className="w-[24px] h-[24px]" strokeWidth={1} style={{ color: '#832729' }} />
            {user && totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-[#832729] text-white text-[10px] rounded-full flex items-center justify-center font-bold px-1">
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
