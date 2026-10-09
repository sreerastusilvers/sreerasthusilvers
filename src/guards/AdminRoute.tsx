import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldX } from 'lucide-react';
import { firstAllowedPath, permissionForPath } from '@/lib/permissions';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, loading, isAdmin, isStaff, permissions } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto" />
          <p className="mt-4 text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Redirect to admin login if not authenticated
  if (!user) {
    return <Navigate to="/admin" state={{ from: location }} replace />;
  }

  // Team members: only the pages the owner gave them. Anything else sends them
  // to their first page (owner-only pages such as Team never open for them).
  if (!isAdmin && isStaff) {
    const needed = permissionForPath(location.pathname);
    if (needed && permissions.includes(needed)) return <>{children}</>;
    const home = firstAllowedPath(permissions);
    if (home && home !== location.pathname) return <Navigate to={home} replace />;
  }

  // Show access denied if user is not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="bg-red-500/10 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <ShieldX className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            You do not have permission to access the admin panel. 
            This area is restricted to administrators only.
          </p>
          <div className="space-y-3">
            <a
              href="/"
              className="block w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Go to Homepage
            </a>
            <button
              onClick={() => window.history.back()}
              className="block w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
