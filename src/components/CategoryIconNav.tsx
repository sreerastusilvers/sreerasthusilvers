import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import { 
  Gem, 
  Armchair, 
  BookOpen, 
  Gift, 
  Flame, 
  UserCircle, 
  Heart, 
  Home, 
  MoreHorizontal,
  ChevronRight
} from "lucide-react";
import { subscribeToCategories, Category } from "@/services/categoryService";

const buildCategoryTarget = (categorySlug: string, subSlug?: string) => {
  const parentSlugMap: Record<string, string> = {
    gifting: "articles",
    "pooja-items": "articles",
    mens: "jewellery",
    wedding: "jewellery",
  };

  const subcategorySlugMap: Record<string, string> = {
    gifting: "gifting",
    "pooja-items": "pooja-items",
    mens: "mens",
    wedding: "wedding",
  };

  const resolvedParent = parentSlugMap[categorySlug] || categorySlug;
  const resolvedSub = subSlug || subcategorySlugMap[categorySlug];

  return resolvedSub
    ? `/category/${resolvedParent}?sub=${resolvedSub}`
    : `/category/${resolvedParent}`;
};

const categories = [
  { 
    name: "Jewellery", 
    icon: Gem, 
    href: buildCategoryTarget("jewellery"),
    image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=200&h=200&fit=crop",
  },
  { 
    name: "Furniture", 
    icon: Armchair, 
    href: buildCategoryTarget("furniture"),
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=200&fit=crop",
  },
  { 
    name: "Articles", 
    icon: BookOpen, 
    href: buildCategoryTarget("articles"),
    image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=200&h=200&fit=crop",
  },
  { 
    name: "Gifting", 
    icon: Gift, 
    href: buildCategoryTarget("gifting"),
    image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=200&h=200&fit=crop",
  },
  { 
    name: "Pooja Items", 
    icon: Flame, 
    href: buildCategoryTarget("pooja-items"),
    image: "https://images.unsplash.com/photo-1610375461246-83df859d849d?w=200&h=200&fit=crop",
  },
  { 
    name: "Men's", 
    icon: UserCircle, 
    href: buildCategoryTarget("mens"),
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=200&h=200&fit=crop",
  },
  { 
    name: "Wedding", 
    icon: Heart, 
    href: buildCategoryTarget("wedding"),
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=200&h=200&fit=crop",
  },
  { 
    name: "Others", 
    icon: Home, 
    href: buildCategoryTarget("others"),
    image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=200&h=200&fit=crop",
  },
];

const ICON_MAP: Record<string, any> = {
  jewellery: Gem,
  furniture: Armchair,
  articles: BookOpen,
  gifting: Gift,
  "pooja-items": Flame,
  "pooja items": Flame,
  mens: UserCircle,
  "men's": UserCircle,
  wedding: Heart,
  others: Home,
  more: MoreHorizontal,
};

const CategoryIconNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const [firebaseCategories, setFirebaseCategories] = useState<Category[]>([]);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [isMobileNavVisible, setIsMobileNavVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollYRef = useRef(0);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch categories from Firebase for subcategory data
  useEffect(() => {
    const unsub = subscribeToCategories((cats) => {
      setFirebaseCategories(cats);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const controlMobileNav = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 10) {
        setIsMobileNavVisible(true);
      } else if (currentScrollY > lastScrollYRef.current) {
        setIsMobileNavVisible(false);
      } else {
        setIsMobileNavVisible(true);
      }

      setIsScrolled(currentScrollY > 50);
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", controlMobileNav);
    return () => window.removeEventListener("scroll", controlMobileNav);
  }, []);

  // Find Firebase category by slug to get subcategories
  const getSubcategories = (slug: string) => {
    const cat = firebaseCategories.find(
      (c) => c.slug === slug || c.name.toLowerCase() === slug.toLowerCase()
    );
    return cat?.subcategories || [];
  };

  const handleMouseEnter = (categoryName: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredCategory(categoryName);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCategory(null);
    }, 150);
  };

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
      {/* ====== MOBILE: Compact icon pills ====== */}
      <section 
        className={`lg:hidden sticky z-40 transition-all duration-500 ${
          isScrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border/40 shadow-[0_1px_0_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_rgba(255,255,255,0.05)]"
            : "bg-background border-b border-border/70"
        } ${
          isMobileNavVisible ? "top-[57px] opacity-100 translate-y-0" : "top-0 opacity-0 -translate-y-full pointer-events-none"
        }`}
      >
        <div ref={mobileScrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide px-2.5 py-1.5">
          {categories.map((category, index) => {
            const isActive = `${location.pathname}${location.search}` === category.href;
            const Icon = category.icon;
            return (
              <motion.a
                key={category.name}
                href={category.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleCategoryClick(category.href);
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className={`group flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 min-w-fit flex-shrink-0 transition-all duration-200 ${
                  isActive
                    ? "border-primary/30 bg-primary/10 text-primary shadow-[0_8px_18px_-14px_rgba(131,39,41,0.65)]"
                    : "border-border/70 bg-background text-muted-foreground"
                }`}
              >
                <div className={`grid place-items-center rounded-full w-7 h-7 transition-colors duration-200 ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/80 group-hover:bg-muted/80"
                }`}>
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.7} />
                </div>
                <span className="text-[10px] font-medium whitespace-nowrap leading-none pr-0.5">
                  {category.name}
                </span>
              </motion.a>
            );
          })}
        </div>
      </section>

      {/* ====== DESKTOP: Clean horizontal nav with subcategory dropdown ====== */}
      <nav
        className={`hidden lg:block relative sticky top-[68px] z-40 transition-all duration-500 ${
          isScrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border/40 shadow-[0_1px_0_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_rgba(255,255,255,0.05)]"
            : "bg-background border-b border-border"
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-8 lg:px-12">
          <div ref={desktopScrollRef} className="flex items-center justify-center gap-1 overflow-x-auto scrollbar-hide">
            {categories.map((category, index) => {
              const isActive = `${location.pathname}${location.search}` === category.href;
              const Icon = category.icon;
              const categorySlug = category.href.split('/category/')[1]?.split('?')[0] || '';
              const subcategories = getSubcategories(categorySlug);
              const hasSubcategories = subcategories.length > 0;

              return (
                <div
                  key={category.name}
                  className="relative"
                  onMouseEnter={() => hasSubcategories && handleMouseEnter(category.name)}
                  onMouseLeave={handleMouseLeave}
                >
                  <motion.a
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

                  {/* Subcategory Dropdown */}
                  <AnimatePresence>
                    {hoveredCategory === category.name && hasSubcategories && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-full left-0 z-50 min-w-[220px] bg-background border border-border rounded-xl shadow-xl py-2 mt-0"
                        onMouseEnter={() => handleMouseEnter(category.name)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {subcategories.map((sub) => (
                          <div key={sub.slug}>
                            <button
                              onClick={() => {
                                setHoveredCategory(null);
                                navigate(`/category/${categorySlug}?sub=${sub.slug}`);
                              }}
                              className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-left"
                            >
                              <span>{sub.name}</span>
                              {sub.children && sub.children.length > 0 && (
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                            </button>
                            {/* Sub-subcategories */}
                            {sub.children && sub.children.length > 0 && (
                              <div className="pl-4">
                                {sub.children.map((child) => (
                                  <button
                                    key={child.slug}
                                    onClick={() => {
                                      setHoveredCategory(null);
                                      navigate(`/category/${categorySlug}?sub=${sub.slug}&subsub=${child.slug}`);
                                    }}
                                    className="w-full px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-left"
                                  >
                                    {child.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
