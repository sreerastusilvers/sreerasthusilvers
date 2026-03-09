import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Filter,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { getAllProducts, deleteProduct, updateProduct, Product } from '@/services/productService';
import { useToast } from '@/hooks/use-toast';

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getAllProducts();
      setProducts(data);
      setFilteredProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch products',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleVisibility = async (product: Product) => {
    try {
      await updateProduct(product.id!, {
        flags: { ...product.flags, isActive: !product.flags.isActive },
      });
      
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? { ...p, flags: { ...p.flags, isActive: !p.flags.isActive } }
            : p
        )
      );
      
      toast({
        title: 'Success',
        description: `Product ${product.flags.isActive ? 'hidden' : 'shown'} on website`,
      });
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast({
        title: 'Error',
        description: 'Failed to update product visibility',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!productToDelete) return;
    
    try {
      await deleteProduct(productToDelete.id!);
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      toast({
        title: 'Success',
        description: 'Product deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">Manage your product catalog</p>
        </div>
        <Link to="/admin/products/new">
          <Button className="bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
          />
        </div>
        <Button
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading products...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                    Product
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                    Category
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                    Price
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                    Stock
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">
                    Status
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/admin/products/${product.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={product.media?.thumbnail || '/placeholder.png'}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover bg-gray-100"
                        />
                        <div>
                          <p className="text-gray-900 font-medium">{product.name}</p>
                          <p className="text-gray-500 text-sm">SKU: {product.inventory?.sku || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-700">{product.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-amber-600 font-medium">₹{product.price}</span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-gray-500 text-sm line-through ml-2">
                          ₹{product.originalPrice}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`${
                          (product.inventory?.stock || 0) > 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {product.inventory?.stock || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.flags?.isActive
                            ? 'bg-green-50 text-green-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {product.flags?.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-gray-900"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-white border-gray-200"
                        >
                          <DropdownMenuItem asChild>
                            <Link
                              to={`/admin/products/${product.id}`}
                              className="text-gray-700 hover:text-gray-900 cursor-pointer"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-gray-700 hover:text-gray-900 cursor-pointer"
                            onClick={() => handleToggleVisibility(product)}
                          >
                            {product.flags?.isActive ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Hide
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Show
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 hover:text-red-700 cursor-pointer"
                            onClick={() => handleDeleteClick(product)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Get started by adding your first product'}
            </p>
            {!searchQuery && (
              <Link to="/admin/products/new">
                <Button className="bg-amber-600 hover:bg-amber-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white border-gray-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900">Delete Product</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600">
              Are you sure you want to delete "{productToDelete?.name}"? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-100 text-gray-900 hover:bg-gray-200 border-0">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
