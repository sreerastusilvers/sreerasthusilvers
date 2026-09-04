import React, { useEffect, useMemo, useState } from 'react';
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
  LayoutGrid,
  List,
  ScanLine,
  X,
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
import {
  subscribeToCategories,
  healDuplicateCategories,
  Category,
} from '@/services/categoryService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { SmartImage } from "@/components/ui/smart-image";
import BarcodeScannerDialog from '@/components/admin/BarcodeScannerDialog';

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subcategoryFilter, setSubcategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [scannerOpen, setScannerOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
    // Admin screens are the only place with write access, so this is where the
    // duplicate category documents left by the old seeding get merged away.
    healDuplicateCategories();
    const unsub = subscribeToCategories(setCategories);
    return unsub;
  }, []);

  /**
   * Search + category/subcategory/status filters.
   *
   * The "Filters" button next to the search box used to be inert, so the only
   * way to see one category's products was to type its name into search - and
   * that also matched every product whose *name* contained the word. Filtering
   * by the stored category value is exact, and search now also matches SKU and
   * barcode so a scanned code finds its product.
   */
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (categoryFilter !== 'all' && (product.category || '') !== categoryFilter) return false;
      if (subcategoryFilter !== 'all' && (product.subcategory || '') !== subcategoryFilter) {
        return false;
      }
      if (statusFilter === 'active' && !product.flags?.isActive) return false;
      if (statusFilter === 'inactive' && product.flags?.isActive) return false;
      if (!q) return true;
      return (
        product.name?.toLowerCase().includes(q) ||
        product.category?.toLowerCase().includes(q) ||
        (product.subcategory || '').toLowerCase().includes(q) ||
        (product.subSubcategory || '').toLowerCase().includes(q) ||
        (product.inventory?.sku || '').toLowerCase().includes(q) ||
        (product.barcode || '').toLowerCase().includes(q)
      );
    });
    setFilteredProducts(filtered);
  }, [searchQuery, products, categoryFilter, subcategoryFilter, statusFilter]);

  /** Subcategories of the selected category, for the second filter dropdown. */
  const subcategoryOptions = useMemo(() => {
    if (categoryFilter === 'all') return [];
    const cat = categories.find((c) => c.name === categoryFilter);
    return cat?.subcategories || [];
  }, [categories, categoryFilter]);

  const activeFilterCount =
    (categoryFilter !== 'all' ? 1 : 0) +
    (subcategoryFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setCategoryFilter('all');
    setSubcategoryFilter('all');
    setStatusFilter('all');
  };

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
      {/* Premium Page Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/40 bg-gradient-to-br from-amber-50 via-white to-orange-50/30 p-5 shadow-sm">
        <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>Products</h1>
            <p className="text-gray-600 mt-1">Curate your silver collection — add, edit, and feature pieces</p>
          </div>
          <Link to="/admin/products/new">
            <Button className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-md">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search by name, category, SKU or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
          onClick={() => setScannerOpen(true)}
          title="Scan a barcode to find its product"
        >
          <ScanLine className="h-4 w-4 mr-2" />
          Scan
        </Button>
        <Button
          variant="outline"
          className="border-gray-300 text-gray-700 hover:bg-gray-50 relative"
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-600 text-white text-[11px] font-semibold">
              {activeFilterCount}
            </span>
          )}
        </Button>
        <div className="flex border border-gray-300 rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 ${viewMode === 'table' ? 'bg-amber-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600">Category</label>
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                setSubcategoryFilter('all');
              }}
            >
              <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Subcategory</label>
            <Select
              value={subcategoryFilter}
              onValueChange={setSubcategoryFilter}
              disabled={categoryFilter === 'all' || subcategoryOptions.length === 0}
            >
              <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="All subcategories" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All subcategories</SelectItem>
                {subcategoryOptions.map((sub) => (
                  <SelectItem key={sub.slug} value={sub.name}>
                    {sub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600">Status</label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}
            >
              <SelectTrigger className="mt-1.5 bg-white border-gray-300 text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {filteredProducts.length} of {products.length} products
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs font-medium text-amber-700 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Products View */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading products...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
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
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(`/admin/products/${product.id}`)}
            >
              <div className="relative aspect-square bg-gray-50">
                <SmartImage
                  src={product.media?.thumbnail || '/placeholder.png'}
                  alt={product.name}
                  className="w-full h-full object-cover" preset="tile" />
                <span
                  className={`absolute top-2 right-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    product.flags?.isActive
                      ? 'bg-green-50 text-green-600'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {product.flags?.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="bg-white/80 hover:bg-white h-8 w-8 p-0 rounded-full shadow">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-white border-gray-200">
                      <DropdownMenuItem asChild>
                        <Link to={`/admin/products/${product.id}`} className="text-gray-700 cursor-pointer">
                          <Edit className="h-4 w-4 mr-2" /> Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-gray-700 cursor-pointer" onClick={() => handleToggleVisibility(product)}>
                        {product.flags?.isActive ? <><EyeOff className="h-4 w-4 mr-2" /> Hide</> : <><Eye className="h-4 w-4 mr-2" /> Show</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600 cursor-pointer" onClick={() => handleDeleteClick(product)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-900 truncate">{product.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                <div className="flex items-center justify-between mt-2">
                  <div>
                    <span className="text-amber-600 font-semibold">₹{product.price}</span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-gray-400 text-xs line-through ml-1">₹{product.originalPrice}</span>
                    )}
                  </div>
                  <span className={`text-xs ${(product.inventory?.stock || 0) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    Stock: {product.inventory?.stock || 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">Product</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">Category</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">Price</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">Stock</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-700">Status</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/products/${product.id}`)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <SmartImage src={product.media?.thumbnail || '/placeholder.png'} alt={product.name} className="w-12 h-12 rounded-lg object-cover bg-gray-100" preset="tile" />
                        <div>
                          <p className="text-gray-900 font-medium">{product.name}</p>
                          <p className="text-gray-500 text-sm">SKU: {product.inventory?.sku || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="text-gray-700">{product.category}</span></td>
                    <td className="px-6 py-4">
                      <span className="text-amber-600 font-medium">₹{product.price}</span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-gray-500 text-sm line-through ml-2">₹{product.originalPrice}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${(product.inventory?.stock || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {product.inventory?.stock || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.flags?.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        {product.flags?.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white border-gray-200">
                          <DropdownMenuItem asChild>
                            <Link to={`/admin/products/${product.id}`} className="text-gray-700 hover:text-gray-900 cursor-pointer">
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-gray-700 hover:text-gray-900 cursor-pointer" onClick={() => handleToggleVisibility(product)}>
                            {product.flags?.isActive ? <><EyeOff className="h-4 w-4 mr-2" /> Hide</> : <><Eye className="h-4 w-4 mr-2" /> Show</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600 hover:text-red-700 cursor-pointer" onClick={() => handleDeleteClick(product)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      <BarcodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDetected={(code) => {
          setSearchQuery(code);
          const hit = products.find((p) => (p.barcode || '').trim() === code.trim());
          toast({
            title: hit ? 'Product found' : 'No product with that barcode',
            description: hit ? hit.name : code,
            variant: hit ? undefined : 'destructive',
          });
        }}
        title="Scan to find a product"
        description="Scanning fills the search box with the barcode."
      />
    </div>
  );
};

export default Products;
