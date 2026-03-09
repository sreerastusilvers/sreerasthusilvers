import Header from "@/components/Header";
import MobileBottomNav from "@/components/MobileBottomNav";
import MobileSearchBar from "@/components/MobileSearchBar";
import CategoryIconNav from "@/components/CategoryIconNav";
import HeroBanner from "@/components/HeroBanner";
import TopDeals from "@/components/TopDeals";
import BestSellers from "@/components/BestSellers";
import MarqueeBand from "@/components/MarqueeBand";
import CategoryShowcase from "@/components/CategoryShowcase";
import FeatureIcons from "@/components/FeatureIcons";
import TrendProducts from "@/components/TrendProducts";
import MobileProductsGrid from "@/components/MobileProductsGrid";
import PromoSection from "@/components/PromoSection";
import FreeShippingBand from "@/components/FreeShippingBand";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import CollectionBanner from "@/components/CollectionBanner";
import InstagramGallery from "@/components/InstagramGallery";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen w-full overflow-x-clip pb-16 lg:pb-0">
      <Header />
      
      {/* Mobile Search Bar - Sticky */}
      <MobileSearchBar />
      
      {/* Category Navigation */}
      <CategoryIconNav />
      
      <main>
        <HeroBanner />
        <TopDeals />
        <BestSellers />
        <MarqueeBand />
        <div className="hidden md:block">
          <CategoryShowcase />
        </div>
        <FeatureIcons />
        <TrendProducts />
        <div className="md:hidden">
          <CategoryShowcase />
          <MobileProductsGrid />
        </div>
        <PromoSection />
        <FreeShippingBand />
        <TestimonialsCarousel />
        <CollectionBanner />
        <InstagramGallery />
      </main>
      
      <Footer />
      <MobileBottomNav />
    </div>
  );
};

export default Index;
