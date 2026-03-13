import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useRef, useEffect } from "react";
import { 
  Gem, 
  Armchair, 
  BookOpen, 
  Gift, 
  Flame, 
  UserCircle, 
  Heart, 
  Home, 
  MoreHorizontal
} from "lucide-react";

const categories = [
  { 
    name: "Jewellery", 
    icon: Gem, 
    href: "/category/jewellery",
    image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=200&h=200&fit=crop",
  },
  { 
    name: "Furniture", 
    icon: Armchair, 
    href: "/category/furniture",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=200&fit=crop",
  },
  { 
    name: "Articles", 
    icon: BookOpen, 
    href: "/category/articles",
    image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=200&h=200&fit=crop",
  },
  { 
    name: "Gifting", 
    icon: Gift, 
    href: "/category/articles?sub=gifting",
    image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=200&h=200&fit=crop",
  },
  { 
    name: "Pooja Items", 
    icon: Flame, 
    href: "/category/articles?sub=pooja-items",
    image: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=200&h=200&fit=crop",
  },
  { 
    name: "Men's", 
    icon: UserCircle, 
    href: "/category/jewellery?sub=mens",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&h=200&fit=crop",
  },
  { 
    name: "Wedding", 
    icon: Heart, 
    href: "/category/jewellery?sub=wedding",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&h=200&fit=crop",
  },
  { 
    name: "Others", 
    icon: Home, 
    href: "/category/others",
    image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=200&h=200&fit=crop",
  },
  { 
    name: "More", 
    icon: MoreHorizontal, 
    href: "/categories",
    image: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=200&h=200&fit=crop",
  },
];

const CategoryIconNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);

  // Restore scroll position on mount
  useEffect(() => {
    const savedMobileScroll = sessionStorage.getItem('categoryMobileScrollPos');
    const savedDesktopScroll = sessionStorage.getItem('categoryDesktopScrollPos');
    
    if (savedMobileScroll && mobileScrollRef.current) {
      mobileScrollRef.current.scrollLeft = parseInt(savedMobileScroll);
    }
    if (savedDesktopScroll && desktopScrollRef.current) {
      desktopScrollRef.current.scrollLeft = parseInt(savedDesktopScroll);
    }
  }, [location.pathname]);

  // Save scroll position before navigation
  const handleCategoryClick = (href: string) => {
    if (href === "#") return;
    
    // Save current scroll positions
    if (mobileScrollRef.current) {
      sessionStorage.setItem('categoryMobileScrollPos', mobileScrollRef.current.scrollLeft.toString());
    }
    if (desktopScrollRef.current) {
      sessionStorage.setItem('categoryDesktopScrollPos', desktopScrollRef.current.scrollLeft.toString());
    }
    
    navigate(href);
  };

  return (
    <>
      {/* ====== MOBILE: Rounded square image categories (CaratLane style) ====== */}
      <section className="lg:hidden bg-background pt-2 pb-3 border-b border-border">
        <div ref={mobileScrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide px-4">
          {categories.map((category, index) => {
            const isActive = location.pathname === category.href;
            return (
              <motion.a
                key={category.name}
                href={category.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleCategoryClick(category.href);
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.04 }}
                className="flex flex-col items-center gap-1.5 min-w-[64px] flex-shrink-0"
              >
                {/* Rounded image with subtle border */}
                <div className={`w-[60px] h-[60px] rounded-2xl overflow-hidden bg-muted ring-1 transition-all duration-200 ${
                  isActive ? "ring-primary ring-2" : "ring-border"
                }`}>
                  <img 
                    src={category.image} 
                    alt={category.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {/* Category Name */}
                <span className={`text-[10px] font-medium text-center leading-tight max-w-[64px] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                  {category.name}
                </span>
              </motion.a>
            );
          })}
        </div>
      </section>

      {/* ====== DESKTOP: Clean horizontal nav (CaratLane style) ====== */}
      <nav className="hidden lg:block bg-background border-b border-border">
        <div className="max-w-[1440px] mx-auto px-8 lg:px-12">
          <div ref={desktopScrollRef} className="flex items-center justify-center gap-1 overflow-x-auto scrollbar-hide">
            {categories.map((category, index) => {
              const isActive = location.pathname === category.href;
              const Icon = category.icon;

              return (
                <motion.a
                  key={category.name}
                  href={category.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleCategoryClick(category.href);
                  }}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap text-[13px] font-medium transition-all duration-200 relative group border-b-2 ${
                    isActive
                      ? "text-primary border-primary"
                      : "text-muted-foreground hover:text-foreground border-transparent hover:border-border"
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-muted-foreground"
                  }`} strokeWidth={1.5} />
                  <span>{category.name}</span>
                </motion.a>
              );
            })}
          </div>
        </div>
      </nav>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
};

export default CategoryIconNav;
