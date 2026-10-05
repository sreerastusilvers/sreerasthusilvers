import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import AccountSidebar from './AccountSidebar';

interface AccountShellProps {
  children: ReactNode;
  className?: string;
}

/**
 * Two-column "My Account" layout from 1024px up: sticky sidebar on the left,
 * the page on the right. Below 1024px it renders the page untouched, so each
 * account screen keeps its own mobile layout.
 */
const AccountShell = ({ children, className }: AccountShellProps) => (
  <div
    className={cn(
      'lg:mx-auto lg:grid lg:max-w-[1440px] lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-8 lg:px-12 lg:py-8 xl:grid-cols-[18rem_minmax(0,1fr)]',
      className,
    )}
  >
    {/* Scrolls on its own if a short window can't fit the whole menu. */}
    <div className="hidden lg:sticky lg:top-[88px] lg:block lg:max-h-[calc(100vh-104px)] lg:overflow-y-auto lg:overscroll-contain lg:p-1 lg:-m-1">
      <AccountSidebar />
    </div>
    <div className="min-w-0">{children}</div>
  </div>
);

export default AccountShell;
