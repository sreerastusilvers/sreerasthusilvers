import { motion, AnimatePresence } from "framer-motion";
import { X, User, ChevronRight, Package, MapPin, ShieldCheck, Heart, MessageCircle, LogOut, Sun, Moon, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import shoppingBags from "@/assets/shopping-bags.png";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileSidebar = ({ isOpen, onClose }: MobileSidebarProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();

  const menuItems = [
    { name: "My Orders", icon: Package, href: "/account/orders" },
    { name: "Edit Profile", icon: UserCog, href: "/account/profile-edit" },
    { name: "Your Addresses", icon: MapPin, href: "/account/addresses" },
    { name: "Login & Security", icon: ShieldCheck, href: "/security" },
    { name: "Saved Items", icon: Heart, href: "/wishlist" },
    { name: "Customer Support", icon: MessageCircle, href: "/customer-support" },
  ];

  const handleNavigation = (href: string) => {
    navigate(href);
    onClose();
  };

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate('/');
  };

  const handleAuthAction = () => {
    navigate('/account');
    onClose();
  };

  const isDark = resolvedTheme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

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
            className="fixed top-0 left-0 bottom-0 w-full bg-background z-50 lg:hidden shadow-2xl overflow-y-auto"
            style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3">
              <User className="w-6 h-6 text-foreground/80" strokeWidth={1.5} />
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-foreground/80" />
              </button>
            </div>

            {/* Promotional / login Banner */}
            <div className="mx-4 mb-3 relative">
              <div
                className="bg-pink-50 dark:bg-pink-950/30 rounded-lg p-4 flex items-center justify-between gap-6 overflow-hidden"
                style={{
                  backgroundImage: `radial-gradient(circle at 0 50%, hsl(var(--background)) 8px, transparent 8px), radial-gradient(circle at 100% 50%, hsl(var(--background)) 8px, transparent 8px)`,
                  backgroundSize: '16px 24px',
                  backgroundPosition: 'left center, right center',
                  backgroundRepeat: 'repeat-y',
                  paddingLeft: '20px',
                  paddingRight: '20px',
                }}
              >
                <div className="flex-shrink-0">
                  <img src={shoppingBags} alt="Shopping bags" className="w-[110px] h-[110px] object-contain" />
                </div>
                <div className="flex-1 text-right min-w-0">
                  {!user ? (
                    <>
                      <h3 className="text-foreground font-bold text-base leading-tight">Flat Rs. 500 off</h3>
                      <p className="text-muted-foreground text-xs mt-0.5 mb-3">on your first order</p>
                      <button
                        onClick={handleAuthAction}
                        className="text-foreground font-bold text-sm tracking-wide hover:underline"
                      >
                        LOGIN / SIGN UP
                      </button>
                    </>
                  ) : (
                    <>
                      <h3 className="text-foreground font-bold text-base leading-tight truncate">
                        Hi, {user.displayName?.split(' ')[0] || 'Welcome'}
                      </h3>
                      <p className="text-muted-foreground text-xs mt-0.5 mb-3 truncate">{user.email}</p>
                      <button
                        onClick={() => handleNavigation('/account/profile-edit')}
                        className="text-primary font-bold text-sm tracking-wide hover:underline"
                      >
                        VIEW PROFILE
                      </button>
                    </>
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
                    transition={{ delay: index * 0.04 }}
                    onClick={() => handleNavigation(item.href)}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors border-b border-border/50"
                  >
                    <Icon className="w-[22px] h-[22px] text-muted-foreground" strokeWidth={1.4} />
                    <span className="text-[15px] font-medium text-foreground flex-1 text-left tracking-wide">
                      {item.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  </motion.button>
                );
              })}

              {/* Theme Toggle */}
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: menuItems.length * 0.04 }}
                onClick={toggleTheme}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors border-b border-border/50"
              >
                {isDark ? (
                  <Sun className="w-[22px] h-[22px] text-amber-500" strokeWidth={1.6} />
                ) : (
                  <Moon className="w-[22px] h-[22px] text-indigo-500" strokeWidth={1.6} />
                )}
                <span className="text-[15px] font-medium text-foreground flex-1 text-left tracking-wide">
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-muted">
                  {isDark ? 'Dark' : 'Light'}
                </span>
              </motion.button>

              {/* Logout */}
              {user && (
                <motion.button
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: (menuItems.length + 1) * 0.04 }}
                  onClick={handleLogout}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors border-b border-border/50"
                >
                  <LogOut className="w-[22px] h-[22px] text-rose-500" strokeWidth={1.4} />
                  <span className="text-[15px] font-medium text-rose-600 dark:text-rose-400 flex-1 text-left tracking-wide">
                    Log Out
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
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
