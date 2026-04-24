import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeft,
  Loader2,
  Heart,
  Star,
  ShoppingBag,
  ArrowLeft,
  Home,
} from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CategoryIconNav from "@/components/CategoryIconNav";
import MobileBottomNav from "@/components/MobileBottomNav";
import { subscribeToProducts } from "@/services/productService";
import { UIProduct, adaptFirebaseArrayToUI } from "@/lib/productAdapter";
import {
  subscribeToCategories,
  seedDefaultCategories,
  Category,
} from "@/services/categoryService";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/hooks/useWishlist";
import { useToast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";

// ─── helpers ──────────────────────────────────────────
const priceRanges = [
  { label: "Under ₹5,000", min: 0, max: 5000 },
  { label: "₹5,000 – ₹15,000", min: 5000, max: 15000 },
  { label: "₹15,000 – ₹50,000", min: 15000, max: 50000 },
  { label: "₹50,000 – ₹1,00,000", min: 50000, max: 100000 },
  { label: "Above ₹1,00,000", min: 100000, max: Infinity },
];

const sortOptions = [
  { value: "recent", label: "Newest First" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A-Z" },
];

// ─── Component ────────────────────────────────────────
const CategoryPage = () => {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { toast } = useToast();

  // Data
  const [allProducts, setAllProducts] = useState<UIProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters from URL
  const activeSub = searchParams.get("sub") || "";
  const activeSubSub = searchParams.get("subsub") || "";
  const activePriceIdx = searchParams.get("price") || "";
  const activeSortBy = searchParams.get("sort") || "recent";

  // UI
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  // Desktop sidebar collapse — persisted per user
  const [desktopFiltersCollapsed, setDesktopFiltersCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('categoryFiltersCollapsed') === '1';
  });
  useEffect(() => {
    localStorage.setItem('categoryFiltersCollapsed', desktopFiltersCollapsed ? '1' : '0');
  }, [desktopFiltersCollapsed]);

  // Seed + subscribe to categories
  useEffect(() => {
    seedDefaultCategories().catch(console.error);
    const unsub = subscribeToCategories((cats) => {
      setCategories(cats);
      // If Firestore returned empty (new DB or permission error), stop loading
      if (cats.length === 0) {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // Current category object
  const currentCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug),
    [categories, categorySlug]
  );

  // Subscribe to products filtered by category name OR subcategory (graceful fallback for un-migrated products)
  useEffect(() => {
    if (!currentCategory) return;
    setLoading(true);
    const catName = currentCategory.name.toLowerCase();
    const catSlug = currentCategory.slug.toLowerCase();
    const unsub = subscribeToProducts((fbProducts) => {
      const ui = adaptFirebaseArrayToUI(fbProducts);
      const filtered = ui.filter((p) => {
        const pc = (p.category || '').toLowerCase();
        const psc = ((p as any).subcategory || '').toLowerCase();
        return (
          pc === catName ||
          pc === catSlug ||
          psc === catName ||
          psc === catSlug
        );
      });
      setAllProducts(filtered);
      setLoading(false);
    }, true);
    return unsub;
  }, [currentCategory]);

  // Apply filters
  const filteredProducts = useMemo(() => {
    let list = [...allProducts];

    // subcategory filter — match against raw product data (we attached subcategory via adapter below)
    if (activeSub) {
      list = list.filter(
        (p) => (p as any).subcategory?.toLowerCase() === activeSub.toLowerCase()
      );
    }
    if (activeSubSub) {
      list = list.filter(
        (p) =>
          (p as any).subSubcategory?.toLowerCase() === activeSubSub.toLowerCase()
      );
    }

    // price range
    if (activePriceIdx !== "") {
      const idx = parseInt(activePriceIdx);
      const range = priceRanges[idx];
      if (range) {
        list = list.filter((p) => p.price >= range.min && p.price < range.max);
      }
    }

    // sort
    switch (activeSortBy) {
      case "price-low":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        list.sort((a, b) => b.price - a.price);
        break;
      case "name-asc":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        break; // 'recent' — keep original order
    }

    return list;
  }, [allProducts, activeSub, activeSubSub, activePriceIdx, activeSortBy]);

  // ── filter helpers ──
  const setFilter = (key: string, val: string) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val);
    else p.delete(key);
    // Reset subsub when sub changes
    if (key === "sub") p.delete("subsub");
    setSearchParams(p, { replace: true });
  };

  const clearAllFilters = () => setSearchParams({}, { replace: true });

  const toggleExpandSub = (slug: string) => {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const activeFilterCount = [activeSub, activeSubSub, activePriceIdx].filter(Boolean).length;

  // ── Override adapter to carry subcategory data ──
  // We re-subscribe with raw data to keep subcategory info
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  useEffect(() => {
    if (!currentCategory) return;
    const unsub = subscribeToProducts((fbProducts) => {
      const catProducts = fbProducts.filter(
        (p) => p.category?.toLowerCase() === currentCategory.name.toLowerCase()
      );
      // Build UI products with extra fields
      const uiProducts = catProducts.map((fp) => {
        const ui = adaptFirebaseArrayToUI([fp])[0];
        return {
          ...ui,
          subcategory: fp.subcategory || "",
          subSubcategory: (fp as any).subSubcategory || "",
        };
      });
      setAllProducts(uiProducts);
      setRawProducts(catProducts);
      setLoading(false);
    }, true);
    return unsub;
  }, [currentCategory]);

  // ── Render: filter sidebar content (reused desktop + mobile) ──
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Subcategories */}
      {currentCategory && currentCategory.subcategories.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
            Subcategories
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => { setFilter("sub", ""); setMobileFiltersOpen(false); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                !activeSub ? "bg-primary text-white" : "text-foreground/80 hover:bg-muted"
              }`}
            >
              All {currentCategory.name}
            </button>
            {currentCategory.subcategories.map((sub) => (
              <div key={sub.slug}>
                <div className="flex items-center">
                  <button
                    onClick={() => { setFilter("sub", sub.slug); setMobileFiltersOpen(false); }}
                    className={`flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSub === sub.slug
                        ? "bg-primary text-white"
                        : "text-foreground/80 hover:bg-muted"
                    }`}
                  >
                    {sub.name}
                  </button>
                  {sub.children && sub.children.length > 0 && (
                    <button
                      onClick={() => toggleExpandSub(sub.slug)}
                      className="p-2 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          expandedSubs.has(sub.slug) ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  )}
                </div>
                {/* Sub-sub-categories dropdown */}
                <AnimatePresence>
                  {expandedSubs.has(sub.slug) && sub.children && sub.children.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden ml-4 space-y-1"
                    >
                      {sub.children.map((child) => (
                        <button
                          key={child.slug}
                          onClick={() => {
                            setFilter("sub", sub.slug);
                            setFilter("subsub", child.slug);
                            setMobileFiltersOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            activeSubSub === child.slug
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {child.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
          Price Range
        </h3>
        <div className="space-y-1">
          {priceRanges.map((range, idx) => (
            <button
              key={idx}
              onClick={() => {
                setFilter("price", activePriceIdx === String(idx) ? "" : String(idx));
                setMobileFiltersOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activePriceIdx === String(idx)
                  ? "bg-primary text-white"
                  : "text-foreground/80 hover:bg-muted"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clear all */}
      {activeFilterCount > 0 && (
        <button
          onClick={() => { clearAllFilters(); setMobileFiltersOpen(false); }}
          className="w-full text-center py-2 text-sm text-primary hover:underline"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );

  // ── Product Card ──
  const ProductCard = ({ product }: { product: UIProduct }) => {
    const wishlisted = isInWishlist(product.id);

    const handleAddToCart = async () => {
      if (!user) {
        navigate("/login", { state: { from: location } });
        return;
      }

      await addToCart({
        id: product.id,
        name: product.title,
        price: product.price,
        image: product.image,
      });

      toast({ title: "Added to cart" });
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-300"
      >
        {/* Image */}
        <div
          className="relative aspect-square overflow-hidden cursor-pointer"
          onClick={() => navigate(`/product/${product.id}`)}
        >
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          {product.badge && (
            <span className="absolute top-2 left-2 bg-primary/90 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
              {product.badge}
            </span>
          )}
          {/* Wishlist heart - always visible top right */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (wishlisted) {
                removeFromWishlist(product.id);
              } else {
                addToWishlist(product.id, product.title);
                toast({ title: "Added to wishlist" });
              }
            }}
            className="absolute top-2 right-2 z-10 w-7 h-7 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm"
          >
            <Heart
              className={`w-3.5 h-3.5 ${wishlisted ? "fill-red-500 text-red-500" : "text-foreground/70"}`}
            />
          </button>
        </div>

        {/* Info */}
        <div className="p-3 space-y-1">
          <h3
            className="text-sm font-medium text-foreground line-clamp-1 cursor-pointer hover:text-primary"
            onClick={() => navigate(`/product/${product.id}`)}
          >
            {product.title}
          </h3>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-xs text-muted-foreground">
              {product.rating} ({product.reviews})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              ₹{product.price.toLocaleString("en-IN")}
            </span>
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">
                ₹{product.oldPrice.toLocaleString("en-IN")}
              </span>
            )}
            {product.discount && product.discount > 0 && (
              <span className="text-xs font-semibold text-[#b88a2a] dark:text-[#f4cf73]">
                {product.discount}% Off
              </span>
            )}
          </div>
          <button
            onClick={() => {
              void handleAddToCart();
            }}
            className="w-full mt-2 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Add to Cart
          </button>
        </div>
      </motion.div>
    );
  };

  if (!currentCategory && !loading && categories.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex flex-col items-center justify-center py-32">
          <p className="text-muted-foreground text-lg">Category not found</p>
          <Link to="/" className="mt-4 text-primary hover:underline">
            Go Home
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <CategoryIconNav />

      {/* Back button + title bar */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">
            {currentCategory?.name || "Products"}
            {activeSub && currentCategory && (
              <span className="text-muted-foreground font-normal">
                {" / "}
                {currentCategory.subcategories.find((s) => s.slug === activeSub)?.name}
              </span>
            )}
          </h1>
        </div>
      </div>

      {/* Mobile: Sort + Filter bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-foreground">
            {currentCategory?.name || "Products"}
          </h1>
          <div className="flex gap-2">
            {/* Sort */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-foreground/80"
              >
                Sort
                <ChevronDown className="w-3 h-3" />
              </button>
              {showSortDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-20 min-w-[160px]">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setFilter("sort", opt.value);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm ${
                          activeSortBy === opt.value
                            ? "text-primary font-medium bg-primary/10"
                            : "text-foreground/80 hover:bg-muted"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Filter button (mobile) */}
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs font-medium text-foreground/80 relative">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-4 overflow-y-auto max-h-[calc(75vh-80px)] pb-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        {/* Active filter chips on mobile */}
        {activeFilterCount > 0 && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
            {activeSub && (
              <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-3 py-1 rounded-full whitespace-nowrap">
                {currentCategory?.subcategories.find((s) => s.slug === activeSub)?.name}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setFilter("sub", "")} />
              </span>
            )}
            {activePriceIdx && (
              <span className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-3 py-1 rounded-full whitespace-nowrap">
                {priceRanges[parseInt(activePriceIdx)]?.label}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setFilter("price", "")} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6 lg:gap-8">
          {/* Desktop sidebar — collapsible */}
          <aside
            className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out ${
              desktopFiltersCollapsed ? 'w-12' : 'w-64'
            }`}
          >
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 scrollbar-thin">
              {desktopFiltersCollapsed ? (
                /* Collapsed rail */
                <button
                  onClick={() => setDesktopFiltersCollapsed(false)}
                  className="group w-10 h-10 mx-auto flex items-center justify-center rounded-lg border border-border bg-background hover:bg-primary/10 hover:border-primary/40 transition-colors"
                  aria-label="Show filters"
                  title="Show filters"
                >
                  <PanelLeft className="w-4 h-4 text-foreground/70 group-hover:text-primary" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-foreground">Filters</h2>
                    <button
                      onClick={() => setDesktopFiltersCollapsed(true)}
                      className="p-1.5 rounded-md hover:bg-muted text-foreground/60 hover:text-foreground transition-colors"
                      aria-label="Hide filters"
                      title="Hide filters"
                    >
                      <PanelLeftClose className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sort */}
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">
                      Sort By
                    </h3>
                    <select
                      value={activeSortBy}
                      onChange={(e) => setFilter("sort", e.target.value)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground/80 bg-background"
                    >
                      {sortOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <FilterContent />
                </div>
              )}
            </div>
          </aside>

          {/* Products grid */}
          <div className="flex-1 min-w-0">
            {/* Desktop: result count + sort */}
            <div className="hidden lg:flex items-center justify-between mb-6">
              <p className="text-sm text-muted-foreground">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} found
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <ShoppingBag className="w-16 h-16 text-primary/30 mb-4" />
                <h3 className="text-lg font-semibold text-foreground/80 mb-2">Products Coming Soon</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                  We're adding exciting new products to this category. Check back soon for our latest collection!
                </p>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default CategoryPage;
