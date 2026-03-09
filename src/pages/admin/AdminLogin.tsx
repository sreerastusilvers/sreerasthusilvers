import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Mail, Lock, Shield } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  // If already logged in as admin, redirect to dashboard
  React.useEffect(() => {
    if (user && isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [user, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userProfile = await login(email, password);
      
      if (userProfile.role !== 'admin') {
        setError('Access denied. Admin credentials required.');
        setLoading(false);
        return;
      }

      navigate('/admin/dashboard');
    } catch (err: any) {
      console.error('Admin login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid admin credentials.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="bg-amber-500/10 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Shield className="h-10 w-10 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Portal</h1>
            <p className="text-gray-600 text-sm">Sree Rasthu Silvers Management</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-gray-700">Admin Email</Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sreerasthu.com"
                  className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-700">Password</Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-amber-500"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 font-medium"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Access Admin Panel'
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 text-xs">
              This is a restricted area. Unauthorized access is prohibited.
            </p>
          </div>
        </div>

        {/* Back to Website Link */}
        <div className="text-center mt-6">
          <a 
            href="/" 
            className="text-gray-600 hover:text-amber-600 text-sm transition-colors"
          >
            ← Back to Website
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
