import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  DollarSign,
  Plus,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAllProducts, Product } from '@/services/productService';
import { getAllOrders, Order } from '@/services/orderService';

interface StatCard {
  title: string;
  value: string;
  subtitle: string;
  change?: string;
  changeType?: 'up' | 'down';
  icon: React.ElementType;
  color: string;
  iconBgColor: string;
  link?: string;
}

const Dashboard = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsData, ordersData] = await Promise.all([
          getAllProducts(),
          getAllOrders()
        ]);
        setProducts(productsData);
        setOrders(ordersData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const lowStockProducts = products.filter(p => (p.inventory?.stock || 0) < 5).length;
  const outOfStockProducts = products.filter(p => (p.inventory?.stock || 0) === 0).length;

  // Calculate order statistics
  const deliveredOrders = orders.filter(order => order.status === 'delivered');
  const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
  const pendingOrders = orders.filter(order => order.status === 'pending').length;

  const stats: StatCard[] = [
    {
      title: 'Total Revenue',
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      subtitle: 'From delivered orders',
      icon: DollarSign,
      color: 'text-green-600',
      iconBgColor: 'bg-green-50',
      link: '/admin/orders',
    },
    {
      title: 'Total Orders',
      value: orders.length.toString(),
      subtitle: `${pendingOrders} pending`,
      icon: ShoppingCart,
      color: 'text-blue-600',
      iconBgColor: 'bg-blue-50',
      link: '/admin/orders',
    },
    {
      title: 'Products',
      value: products.length.toString(),
      subtitle: `${outOfStockProducts} out of stock`,
      icon: Package,
      color: 'text-purple-600',
      iconBgColor: 'bg-purple-50',
      link: '/admin/products',
    },
    {
      title: 'Low Stock Items',
      value: lowStockProducts.toString(),
      subtitle: 'Needs attention',
      icon: Clock,
      color: 'text-orange-600',
      iconBgColor: 'bg-orange-50',
      link: '/admin/products',
    },
  ];

  const recentProducts = products.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome to Sreerasthu Silvers Admin Panel</p>
        </div>
        <Link to="/admin/products/new">
          <Button className="bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card 
            key={index} 
            className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => stat.link && navigate(stat.link)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-gray-600 text-xs font-medium">{stat.title}</h3>
                <div className={`${stat.iconBgColor} p-2 rounded-lg`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
              <div className="space-y-0.5">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-gray-500 text-xs">{stat.subtitle}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-gray-900 text-base">Recent Products</CardTitle>
            <Link to="/admin/products">
              <Button variant="ghost" size="sm" className="text-amber-500 hover:text-amber-400">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentProducts.length > 0 ? (
              <div className="space-y-3">
                {recentProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <img
                      src={product.media?.thumbnail || '/placeholder.png'}
                      alt={product.name}
                      className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-medium truncate">{product.name}</p>
                      <p className="text-gray-500 text-xs">{product.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-600 text-sm font-medium">₹{product.price}</p>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          product.flags?.isActive
                            ? 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {product.flags?.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No products yet</p>
                <Link to="/admin/products/new">
                  <Button className="mt-4 bg-amber-600 hover:bg-amber-700" size="sm">
                    Add First Product
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-gray-900 text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/products/new" className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <Package className="h-4 w-4 mr-2" />
                Add New Product
              </Button>
            </Link>
            <Link to="/admin/orders" className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                View Orders
              </Button>
            </Link>
            <Link to="/admin/media" className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload Media
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
