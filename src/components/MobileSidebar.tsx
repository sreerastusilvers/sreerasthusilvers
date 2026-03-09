import { motion, AnimatePresence } from "framer-motion";
import { X, User, ChevronRight, House, LayoutGrid, ShoppingCart, Heart, Settings, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import shoppingBags from "@/assets/shopping-bags.png";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileSidebar = ({ isOpen, onClose }: MobileSidebarProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const menuItems = [
    { name: "Home", icon: House, href: "/" },
    { name: "Categories", icon: LayoutGrid, href: "/categories" },
    { name: "My Orders", icon: ShoppingCart, href: "/account/orders" },
    { name: "Wishlist", icon: Heart, href: "/wishlist" },
    { name: "Settings", icon: Settings, href: "/account" },
  ];

  const handleNavigation = async (href: string) => {
    if (href === "#logout") {
      await logout();
      onClose();
      navigate('/');
    } else {
      navigate(href);
      onClose();
    }
  };

  const handleAuthAction = (action: 'login' | 'signup') => {
    navigate('/account');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 z-50 lg:hidden"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-full bg-white z-50 lg:hidden shadow-2xl overflow-y-auto"
            style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
          >
            {/* Header with User Icon and Close Button */}
            <div className="flex items-center justify-between px-4 py-3">
              <User className="w-6 h-6 text-gray-700" strokeWidth={1.5} />
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Promotional Banner - Ticket/Coupon Style */}
              <div className="mx-4 mb-2 relative">
                {/* Scalloped border ticket */}
                <div
                  className="bg-pink-50 rounded-lg p-4 flex items-center justify-between gap-6 overflow-hidden"
                  style={{
                    backgroundImage: `radial-gradient(circle at 0 50%, white 8px, transparent 8px), radial-gradient(circle at 100% 50%, white 8px, transparent 8px)`,
                    backgroundSize: '16px 24px',
                    backgroundPosition: 'left center, right center',
                    backgroundRepeat: 'repeat-y',
                    paddingLeft: '20px',
                    paddingRight: '20px',
                  }}
                >
                  {/* Shopping bags image - bigger */}
                  <div className="flex-shrink-0">
                    <img 
                      src={shoppingBags} 
                      alt="Shopping bags" 
                      className="w-[120px] h-[120px] object-contain"
                    />
                  </div>

                  {/* Text content - completely on the right */}
                  <div className="flex-1 text-right">
                    <h3 className="text-gray-900 font-bold text-base leading-tight">
                      Flat Rs. 500 off
                    </h3>
                    <p className="text-gray-500 text-xs mt-0.5 mb-3">
                      on your first order
                    </p>
                    {!user ? (
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleAuthAction('login')}
                          className="text-gray-900 font-bold text-sm tracking-wide hover:underline"
                        >
                          LOGIN
                        </button>
                        <span className="text-gray-400 font-light">|</span>
                        <button
                          onClick={() => handleAuthAction('signup')}
                          className="text-gray-900 font-bold text-sm tracking-wide hover:underline"
                        >
                          SIGN UP
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleNavigation('/wishlist')}
                        className="text-[#832729] font-bold text-base hover:text-[#a02f32] transition-colors"
                      >
                        |MY PROFILE|
                      </button>
                    )}
                  </div>
                </div>
              </div>

            {/* Menu Items */}
            <div className="flex flex-col">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleNavigation(item.href)}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50"
                  >
                    <Icon className="w-[22px] h-[22px] text-gray-600" strokeWidth={1.4} />
                    <span className="text-[15px] font-medium text-gray-800 flex-1 text-left tracking-wide">
                      {item.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                  </motion.button>
                );
              })}
              
              {/* Logout Button (only show when logged in) */}
              {user && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: menuItems.length * 0.05 }}
                  onClick={() => handleNavigation("#logout")}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors border-b border-gray-50"
                >
                  <LogOut className="w-[22px] h-[22px] text-gray-600" strokeWidth={1.4} />
                  <span className="text-[15px] font-medium text-gray-800 flex-1 text-left tracking-wide">
                    Logout
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                </motion.button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileSidebar;
