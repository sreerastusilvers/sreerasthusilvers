import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Package,
  RotateCcw,
  User,
  MapPin,
  Shield,
  Heart,
  Video,
  Gem,
  MessageCircle,
  LogOut,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import UserAvatar from './UserAvatar';
import { useAccountIdentity } from './useAccountIdentity';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Extra paths (prefixes end with "/") that also mark this item active. */
  match?: string[];
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

/** Only routes that exist in App.tsx. */
export const ACCOUNT_NAV: NavGroup[] = [
  {
    heading: 'Orders',
    items: [
      { label: 'My orders', to: '/account', icon: Package, match: ['/account/orders', '/account/orders/'] },
      { label: 'Buy again', to: '/buy-again', icon: RotateCcw },
    ],
  },
  {
    heading: 'Account settings',
    items: [
      { label: 'Profile information', to: '/account/profile-edit', icon: User },
      { label: 'Saved addresses', to: '/account/addresses', icon: MapPin },
      { label: 'Login & security', to: '/security', icon: Shield },
    ],
  },
  {
    heading: 'My stuff',
    items: [
      { label: 'Wishlist', to: '/wishlist', icon: Heart },
      { label: 'Video calls', to: '/my-video-calls', icon: Video },
      { label: 'Purchase summary', to: '/purchase-summary', icon: Gem, match: ['/wallet'] },
    ],
  },
  {
    heading: 'Help',
    items: [{ label: 'Customer support', to: '/customer-support', icon: MessageCircle }],
  },
];

const isActive = (item: NavItem, pathname: string) => {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === item.to) return true;
  return (item.match ?? []).some((m) => (m.endsWith('/') ? path.startsWith(m) : path === m));
};

const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card';

/** Desktop "My Account" sidebar: who is signed in, grouped links, log out. */
const AccountSidebar = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { name, email } = useAccountIdentity();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out');
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out');
    }
  };

  return (
    <aside aria-label="My account" className="space-y-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* Who is signed in */}
      <Link
        to="/account/profile-edit"
        className={cn(
          'group flex items-center gap-3.5 rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors duration-150 hover:border-primary/40',
          focusRing,
        )}
      >
        <UserAvatar size={52} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">Hello,</span>
          <span className="block truncate text-[15px] font-semibold text-foreground" title={name}>
            {name}
          </span>
          {email && (
            <span className="block truncate text-xs text-muted-foreground" title={email}>
              {email}
            </span>
          )}
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-primary"
          aria-hidden
        />
      </Link>

      {/* Links */}
      <nav aria-label="Account sections" className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        {ACCOUNT_NAV.map((group) => (
          <div key={group.heading} className="border-b border-border/60 px-2 py-2.5 last:border-b-0">
            <h2
              className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              style={{ fontFamily: 'inherit' }}
            >
              {group.heading}
            </h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item, pathname);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex min-h-[38px] items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150',
                        focusRing,
                        active
                          ? 'bg-primary/10 font-semibold text-primary before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary'
                          : 'text-foreground/80 hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2 : 1.6} aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="px-2 py-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className={cn(
              'flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-700 transition-[background-color,transform] duration-150 hover:bg-rose-50 active:scale-[0.98] motion-reduce:active:scale-100 dark:text-rose-400 dark:hover:bg-rose-950/40',
              focusRing,
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} aria-hidden />
            Log out
          </button>
        </div>
      </nav>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to see your orders and saved details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
};

export default AccountSidebar;
