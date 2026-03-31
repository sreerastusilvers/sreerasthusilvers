import React from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/dark.png';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Image,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Layers,
  Truck,
  MessageSquare,
  Gift,
  Star,
  Settings,
  Users2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [contentMediaOpen, setContentMediaOpen] = React.useState(false);
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/admin');
  };

  const contentMediaPaths = ['/admin/banners', '/admin/showcases', '/admin/testimonials', '/admin/gallery', '/admin/reviews'];
  const isContentMediaActive = contentMediaPaths.some(p => location.pathname.startsWith(p));

  const mainNavItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/products', icon: Package, label: 'Products' },
    { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
    { path: '/admin/delivery-boys', icon: Truck, label: 'Delivery Boys' },
    { path: '/admin/customers', icon: Users2, label: 'Customers' },
    { path: '/admin/gift-cards', icon: Gift, label: 'Coupons' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  const contentMediaItems = [
    { path: '/admin/banners', icon: Layers, label: 'Banners' },
    { path: '/admin/showcases', icon: Layers, label: 'Showcases' },
    { path: '/admin/testimonials', icon: MessageSquare, label: 'Testimonials' },
    { path: '/admin/gallery', icon: Image, label: 'Gallery' },
    { path: '/admin/reviews', icon: Star, label: 'Reviews' },
  ];

  return (
    <div className="min-h-screen bg-[#FBF8F3] font-['Poppins']" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <style>{`
        .admin-panel h1, .admin-panel h2, .admin-panel h3, 
        .admin-panel h4, .admin-panel h5, .admin-panel h6 {
          font-family: 'Poppins', sans-serif !important;
        }
      `}</style>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[#FFFBF5] border-r border-[#F5EFE6] transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#F5EFE6] flex-shrink-0">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Sree Rasthu Silvers" className="h-8 w-auto" />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation - Scrollable (hidden scrollbar) */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {/* Main nav items (all except Settings) */}
          {mainNavItems.slice(0, -1).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[#FFF9E6] text-amber-700 font-medium'
                    : 'text-gray-700 hover:bg-[#FFF9E6]/50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Content & Media Dropdown */}
          <div>
            <button
              onClick={() => setContentMediaOpen(!contentMediaOpen)}
              className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-colors ${
                isContentMediaActive
                  ? 'bg-[#FFF9E6] text-amber-700 font-medium'
                  : 'text-gray-700 hover:bg-[#FFF9E6]/50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Image className="h-5 w-5" />
                <span>Content & Media</span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${contentMediaOpen || isContentMediaActive ? 'rotate-180' : ''}`} />
            </button>
            {(contentMediaOpen || isContentMediaActive) && (
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-[#F5EFE6] pl-3">
                {contentMediaItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                        isActive
                          ? 'bg-[#FFF9E6] text-amber-700 font-medium'
                          : 'text-gray-600 hover:bg-[#FFF9E6]/50 hover:text-gray-900'
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Settings */}
          <NavLink
            to={mainNavItems[mainNavItems.length - 1].path}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#FFF9E6] text-amber-700 font-medium'
                  : 'text-gray-700 hover:bg-[#FFF9E6]/50 hover:text-gray-900'
              }`
            }
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </NavLink>

          {/* Logout Button - Inside Scroll Area */}
          <div className="pt-4 mt-4 border-t border-[#F5EFE6]">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full text-gray-700 hover:bg-[#FFF9E6]/50 hover:text-gray-900 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Header */}
        <header className="h-16 bg-[#FFFBF5] border-b border-[#F5EFE6] flex items-center justify-between px-4 lg:px-6">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Search (placeholder) */}
          <div className="hidden md:block flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search..."
              className="w-full bg-white border border-[#F5EFE6] rounded-lg px-4 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-600"
            />
          </div>

          {/* Theme Toggle & User Menu */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100"
              >
                <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {userProfile?.username?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
                <span className="hidden md:block">{userProfile?.username || 'Admin'}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white border-[#F5EFE6]">
              <DropdownMenuItem
                className="text-red-600 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6 admin-panel">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
