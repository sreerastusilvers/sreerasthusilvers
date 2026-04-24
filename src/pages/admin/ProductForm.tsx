import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Video,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  createProduct,
  updateProduct,
  getProduct,
  generateSlug,
  Product,
} from '@/services/productService';
import {
  uploadToCloudinary,
  validateFile,
  UploadProgress,
} from '@/services/cloudinaryService';
import {
  subscribeToCategories,
  seedDefaultCategories,
  addSubcategory,
  addSubSubcategory,
  Category,
} from '@/services/categoryService';

// YouTube helpers
function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

// Spec suggestions stored in localStorage
const SPEC_SUGGESTIONS_KEY = 'admin_spec_suggestions';

function loadSpecSuggestions(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(SPEC_SUGGESTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSpecSuggestion(label: string, value: string) {
  const suggestions = loadSpecSuggestions();
  const key = label.toLowerCase().trim();
  if (!key || !value.trim()) return;
  if (!suggestions[key]) suggestions[key] = [];
  if (!suggestions[key].includes(value.trim())) {
    suggestions[key].push(value.trim());
    if (suggestions[key].length > 20) suggestions[key] = suggestions[key].slice(-20);
  }
  localStorage.setItem(SPEC_SUGGESTIONS_KEY, JSON.stringify(suggestions));
}

const ProductForm = () => {
  const { productId } = useParams();
  const isEditing = !!productId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(isEditing);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [imageUploadMode, setImageUploadMode] = useState<'upload' | 'url'>('upload');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [newSubSubcategory, setNewSubSubcategory] = useState('');
  const [addingSub, setAddingSub] = useState(false);
  const [addingSubSub, setAddingSubSub] = useState(false);

  // Categories from Firestore
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    seedDefaultCategories();
    const unsub = subscribeToCategories(setCategories);
    return unsub;
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subcategory: '',
    subSubcategory: '',
    description: '',
    tags: '',
    price: '',
    originalPrice: '',
    discount: '',
    discountType: 'percent' as 'percent' | 'amount',
    stock: '',
    weight: '',
    weightUnit: 'grams' as 'grams' | 'kgs',
    isActive: true,
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    isTopDeal: false,
    isTrendProduct: false,
  });

  // Dynamic specifications
  const [specifications, setSpecifications] = useState<{ label: string; value: string }[]>([
    { label: 'Material', value: '' },
    { label: 'Purity', value: '' },
    { label: 'Dimensions', value: '' },
  ]);

  const [specSuggestions, setSpecSuggestions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setSpecSuggestions(loadSpecSuggestions());
  }, []);

  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<string>('');

  // Derived subcategories
  const selectedCategory = categories.find((c) => c.name === formData.category);
  const subcategoryOptions = selectedCategory?.subcategories || [];
  const selectedSubcategory = subcategoryOptions.find((s) => s.name === formData.subcategory);
  const subSubcategoryOptions = selectedSubcategory?.children || [];

  // Fetch product if editing
  useEffect(() => {
    if (isEditing && productId) {
      fetchProductData();
    }
  }, [productId]);

  const fetchProductData = async () => {
    try {
      const product = await getProduct(productId!);
      if (product) {
        setFormData({
          name: product.name,
          category: product.category,
          subcategory: product.subcategory || '',
          subSubcategory: (product as any).subSubcategory || '',
          description: product.description,
          tags: '',
          price: product.price.toString(),
          originalPrice: product.originalPrice?.toString() || '',
          discount: product.discount?.toString() || '',
          discountType: 'percent',
          stock: product.inventory?.stock?.toString() || '',
          weight: product.inventory?.weight || '',
          weightUnit: product.inventory?.weightUnit || 'grams',
          isActive: product.flags?.isActive ?? true,
          isFeatured: product.flags?.isFeatured ?? false,
          isNewArrival: product.flags?.isNewArrival ?? false,
          isBestSeller: product.flags?.isBestSeller ?? false,
          isTopDeal: (product.flags as any)?.isTopDeal ?? false,
          isTrendProduct: (product.flags as any)?.isTrendProduct ?? false,
        });
        setImages(product.media?.images || []);
        setVideos(product.media?.videos || []);
        setThumbnail(product.media?.thumbnail || '');

        const specs = product.specifications || {};
        const specEntries: { label: string; value: string }[] = [];
        const defaultLabels = ['material', 'purity', 'dimensions'];
        defaultLabels.forEach((key) => {
          const val = (specs as any)[key] || '';
          specEntries.push({ label: key.charAt(0).toUpperCase() + key.slice(1), value: val });
        });
        Object.keys(specs).forEach((key) => {
          if (!defaultLabels.includes(key.toLowerCase())) {
            specEntries.push({ label: key, value: (specs as any)[key] });
          }
        });
        if (specEntries.length > 0) setSpecifications(specEntries);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast({ title: 'Error', description: 'Failed to fetch product details', variant: 'destructive' });
    } finally {
      setFetchingProduct(false);
    }
  };

  // Handle adding custom subcategory
  const handleAddSubcategory = async () => {
    if (!newSubcategory.trim() || !selectedCategory?.id) return;
    setAddingSub(true);
    try {
      await addSubcategory(selectedCategory.id, selectedCategory.subcategories, newSubcategory.trim());
      setFormData((prev) => ({ ...prev, subcategory: newSubcategory.trim(), subSubcategory: '' }));
      setNewSubcategory('');
      toast({ title: 'Success', description: 'Subcategory added' });
    } catch {
      toast({ title: 'Error', description: 'Failed to add subcategory', variant: 'destructive' });
    } finally {
      setAddingSub(false);
    }
  };

  // Handle adding custom sub-subcategory
  const handleAddSubSubcategory = async () => {
    if (!newSubSubcategory.trim() || !selectedCategory?.id || !selectedSubcategory) return;
    setAddingSubSub(true);
    try {
      await addSubSubcategory(selectedCategory.id, selectedCategory.subcategories, selectedSubcategory.slug, newSubSubcategory.trim());
      setFormData((prev) => ({ ...prev, subSubcategory: newSubSubcategory.trim() }));
      setNewSubSubcategory('');
      toast({ title: 'Success', description: 'Sub-subcategory added' });
    } catch {
      toast({ title: 'Error', description: 'Failed to add sub-subcategory', variant: 'destructive' });
    } finally {
      setAddingSubSub(false);
    }
  };

  // Auto-calculate pricing
  const recalcPricing = useCallback(
    (field: 'price' | 'originalPrice' | 'discount', value: string) => {
      setFormData((prev) => {
        const next = { ...prev, [field]: value };
        const original = parseFloat(next.originalPrice) || 0;
        const price = parseFloat(next.price) || 0;
        const discount = parseFloat(next.discount) || 0;

        if (field === 'price' && original > 0 && price > 0) {
          const disc = ((original - price) / original) * 100;
          next.discount = disc > 0 ? disc.toFixed(1) : '0';
          next.discountType = 'percent';
        } else if (field === 'originalPrice' && price > 0 && original > 0) {
          const disc = ((original - price) / original) * 100;
          next.discount = disc > 0 ? disc.toFixed(1) : '0';
          next.discountType = 'percent';
        } else if (field === 'discount' && original > 0 && discount >= 0) {
          if (next.discountType === 'percent') {
            next.price = (original - (original * discount) / 100).toFixed(2);
          } else {
            next.price = (original - discount).toFixed(2);
          }
        }
        return next;
      });
    },
    []
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (['price', 'originalPrice', 'discount'].includes(name)) {
      recalcPricing(name as any, value);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Image handlers
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    setUploadProgress(0);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const validation = validateFile(file, { maxSizeMB: 10, allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] });
        if (!validation.valid) {
          toast({ title: 'Invalid File', description: validation.error, variant: 'destructive' });
          continue;
        }
        const result = await uploadToCloudinary(file, (progress: UploadProgress) => {
          setUploadProgress(Math.round(((i + progress.percentage / 100) / files.length) * 100));
        });
        uploadedUrls.push(result.secure_url);
      }
      setImages((prev) => [...prev, ...uploadedUrls]);
      if (!thumbnail && uploadedUrls.length > 0) setThumbnail(uploadedUrls[0]);
      toast({ title: 'Success', description: `${uploadedUrls.length} image(s) uploaded` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to upload images', variant: 'destructive' });
    } finally {
      setUploadingImages(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = (url: string) => {
    setImages((prev) => prev.filter((img) => img !== url));
    if (thumbnail === url) setThumbnail(images.find((img) => img !== url) || '');
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    try {
      new URL(imageUrlInput);
      setImages((prev) => [...prev, imageUrlInput]);
      if (!thumbnail) setThumbnail(imageUrlInput);
      setImageUrlInput('');
      toast({ title: 'Success', description: 'Image URL added' });
    } catch {
      toast({ title: 'Invalid URL', description: 'Please enter a valid URL', variant: 'destructive' });
    }
  };

  // Video handlers – YouTube extraction
  const handleAddVideoUrl = () => {
    if (!videoUrlInput.trim()) return;
    if (isYouTubeUrl(videoUrlInput)) {
      const ytId = extractYouTubeId(videoUrlInput);
      if (ytId) {
        setVideos((prev) => [...prev, 'yt:' + ytId]);
        setVideoUrlInput('');
        toast({ title: 'Success', description: 'YouTube video added' });
        return;
      }
    }
    try {
      new URL(videoUrlInput);
      setVideos((prev) => [...prev, videoUrlInput]);
      setVideoUrlInput('');
      toast({ title: 'Success', description: 'Video URL added' });
    } catch {
      toast({ title: 'Invalid URL', description: 'Please enter a valid URL', variant: 'destructive' });
    }
  };

  // Specification handlers
  const handleSpecChange = (index: number, field: 'label' | 'value', val: string) => {
    setSpecifications((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };
  const addSpecRow = () => setSpecifications((prev) => [...prev, { label: '', value: '' }]);
  const removeSpecRow = (index: number) => setSpecifications((prev) => prev.filter((_, i) => i !== index));

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category || !formData.price) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }
    if (images.length === 0) {
      toast({ title: 'Validation Error', description: 'Please upload at least one product image', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      specifications.forEach((spec) => {
        if (spec.label && spec.value) saveSpecSuggestion(spec.label, spec.value);
      });
      setSpecSuggestions(loadSpecSuggestions());

      const specsObj: Record<string, string> = {};
      specifications.forEach((spec) => {
        if (spec.label.trim()) specsObj[spec.label.trim().toLowerCase()] = spec.value.trim();
      });

      const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
        name: formData.name,
        slug: generateSlug(formData.name),
        category: formData.category,
        subcategory: formData.subcategory || undefined,
        subSubcategory: formData.subSubcategory || undefined,
        description: formData.description,
        price: parseFloat(formData.price),
        ...(formData.originalPrice && { originalPrice: parseFloat(formData.originalPrice) }),
        ...(formData.discount && { discount: parseFloat(formData.discount) }),
        currency: 'INR',
        media: { images, videos, thumbnail: thumbnail || images[0] },
        inventory: { stock: parseInt(formData.stock) || 0, sku: '', weight: formData.weight, weightUnit: formData.weightUnit },
        specifications: specsObj as any,
        flags: { isActive: formData.isActive, isFeatured: formData.isFeatured, isNewArrival: formData.isNewArrival, isBestSeller: formData.isBestSeller, isTopDeal: formData.isTopDeal, isTrendProduct: formData.isTrendProduct },
      } as any;

      if (isEditing) {
        await updateProduct(productId!, productData);
        toast({ title: 'Success', description: 'Product updated successfully' });
      } else {
        await createProduct(productData, user!.uid);
        toast({ title: 'Success', description: 'Product created successfully' });
      }
      navigate('/admin/products');
    } catch (error) {
      console.error('Error saving product:', error);
      toast({ title: 'Error', description: 'Failed to ' + (isEditing ? 'update' : 'create') + ' product', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingProduct) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/products')} className="text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            {isEditing ? 'Update product details' : 'Add a new product to your catalog'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* Basic Info */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-700">Product Name *</Label>
                <Input name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter product name" className="mt-2 bg-gray-100 border-gray-300 text-gray-900" required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-700">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value, subcategory: '', subSubcategory: '' }))}>
                    <SelectTrigger className="mt-2 bg-gray-100 border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name} className="text-gray-900">{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-700">Subcategory</Label>
                  <Select value={formData.subcategory} onValueChange={(value) => setFormData((prev) => ({ ...prev, subcategory: value, subSubcategory: '' }))} disabled={!formData.category || subcategoryOptions.length === 0}>
                    <SelectTrigger className="mt-2 bg-gray-100 border-gray-300 text-gray-900">
                      <SelectValue placeholder={subcategoryOptions.length > 0 ? 'Select subcategory' : 'No subcategories'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      {subcategoryOptions.map((sub) => (
                        <SelectItem key={sub.slug} value={sub.name} className="text-gray-900">{sub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.category && selectedCategory && (
                    <div className="flex gap-1.5 mt-1.5">
                      <Input value={newSubcategory} onChange={(e) => setNewSubcategory(e.target.value)} placeholder="New subcategory" className="h-8 text-xs bg-white border-gray-300" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubcategory())} />
                      <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs border-gray-300" onClick={handleAddSubcategory} disabled={addingSub || !newSubcategory.trim()}>
                        {addingSub ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-gray-700">Sub-subcategory</Label>
                  <Select value={formData.subSubcategory} onValueChange={(value) => setFormData((prev) => ({ ...prev, subSubcategory: value }))} disabled={!formData.subcategory || subSubcategoryOptions.length === 0}>
                    <SelectTrigger className="mt-2 bg-gray-100 border-gray-300 text-gray-900">
                      <SelectValue placeholder={subSubcategoryOptions.length > 0 ? 'Select sub-subcategory' : 'None'} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      {subSubcategoryOptions.map((child) => (
                        <SelectItem key={child.slug} value={child.name} className="text-gray-900">{child.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.subcategory && selectedSubcategory && (
                    <div className="flex gap-1.5 mt-1.5">
                      <Input value={newSubSubcategory} onChange={(e) => setNewSubSubcategory(e.target.value)} placeholder="New sub-subcategory" className="h-8 text-xs bg-white border-gray-300" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubSubcategory())} />
                      <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs border-gray-300" onClick={handleAddSubSubcategory} disabled={addingSubSub || !newSubSubcategory.trim()}>
                        {addingSubSub ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-gray-700">Description</Label>
                <Textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="Enter product description" className="mt-2 bg-gray-100 border-gray-300 text-gray-900 min-h-[120px]" />
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Images */}
              <div>
                <Label className="text-gray-700">Product Images *</Label>
                <div className="flex gap-2 mt-2 mb-3">
                  <button type="button" onClick={() => setImageUploadMode('upload')} className={'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ' + (imageUploadMode === 'upload' ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                    Upload Files
                  </button>
                  <button type="button" onClick={() => setImageUploadMode('url')} className={'flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ' + (imageUploadMode === 'url' ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                    Paste URL
                  </button>
                </div>

                {imageUploadMode === 'upload' ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-amber-600 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {uploadingImages ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-2" />
                          <p className="text-sm text-gray-600">Uploading... {uploadProgress}%</p>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-gray-600 mb-2" />
                          <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                          <p className="text-xs text-gray-500">PNG, JPG, WebP up to 10MB</p>
                        </>
                      )}
                    </div>
                    <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} disabled={uploadingImages} />
                  </label>
                ) : (
                  <div className="flex gap-2">
                    <Input type="url" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)} placeholder="https://example.com/image.jpg" className="flex-1 bg-white border-gray-300" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImageUrl())} />
                    <Button type="button" onClick={handleAddImageUrl} className="bg-gray-900 hover:bg-gray-800 text-white">Add</Button>
                  </div>
                )}

                {images.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-4 mb-2">
                      <p className="text-xs text-gray-500">{images.length} image{images.length !== 1 ? 's' : ''} • drag to reorder • first image is shown in cards</p>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {images.map((url, index) => (
                        <div
                          key={url + index}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(index));
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const from = Number(e.dataTransfer.getData('text/plain'));
                            const to = index;
                            if (from === to || isNaN(from)) return;
                            setImages((prev) => {
                              const next = [...prev];
                              const [moved] = next.splice(from, 1);
                              next.splice(to, 0, moved);
                              return next;
                            });
                          }}
                          className="relative group cursor-move"
                        >
                          <div className="w-full aspect-square bg-gray-200 rounded-lg overflow-hidden ring-1 ring-gray-200">
                            <img src={url} alt={'Product ' + (index + 1)} className={'w-full h-full object-cover ' + (thumbnail === url ? 'ring-2 ring-amber-500' : '')} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <button type="button" onClick={() => setThumbnail(url)} className="p-1.5 bg-amber-600 hover:bg-amber-700 rounded text-white" title="Set as thumbnail"><ImageIcon className="h-4 w-4" /></button>
                            <button type="button" onClick={() => handleRemoveImage(url)} className="p-1.5 bg-red-500 hover:bg-red-600 rounded text-white" title="Remove"><X className="h-4 w-4" /></button>
                          </div>
                          <span className="absolute top-1 right-1 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">#{index + 1}</span>
                          {thumbnail === url && <span className="absolute top-1 left-1 bg-amber-600 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">THUMB</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Videos – YouTube aware */}
              <div>
                <Label className="text-gray-700">Product Videos (Optional)</Label>
                <p className="text-xs text-gray-500 mt-1 mb-2">Paste a YouTube URL and we auto-extract the video ID. Or paste a direct video URL.</p>
                <div className="flex gap-2">
                  <Input type="url" value={videoUrlInput} onChange={(e) => setVideoUrlInput(e.target.value)} placeholder="https://youtube.com/watch?v=... or video URL" className="flex-1 bg-white border-gray-300" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVideoUrl())} />
                  <Button type="button" onClick={handleAddVideoUrl} className="bg-gray-900 hover:bg-gray-800 text-white">Add</Button>
                </div>
                {videos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                    {videos.map((v, index) => {
                      const isYt = v.startsWith('yt:');
                      const ytId = isYt ? v.replace('yt:', '') : null;
                      return (
                        <div key={index} className="relative group rounded-lg overflow-hidden bg-gray-100">
                          {ytId ? (
                            <img src={'https://img.youtube.com/vi/' + ytId + '/mqdefault.jpg'} alt="YouTube video" className="w-full aspect-video object-cover" />
                          ) : (
                            <div className="w-full aspect-video flex items-center justify-center">
                              <Video className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button type="button" onClick={() => setVideos((prev) => prev.filter((_, i) => i !== index))} className="p-1 bg-red-500 rounded text-white"><X className="h-4 w-4" /></button>
                          </div>
                          {ytId && <span className="absolute top-1 left-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">YouTube</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <Label className="text-gray-700">Tags (optional)</Label>
                <Input name="tags" value={formData.tags} onChange={handleInputChange} placeholder="new, featured, bestseller (comma-separated)" className="mt-2 bg-white border-gray-300 text-gray-900" />
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Inventory */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Pricing & Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-700">Original Price (&#8377;)</Label>
                  <Input name="originalPrice" type="number" value={formData.originalPrice} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" className="mt-2 bg-gray-100 border-gray-300 text-gray-900" />
                </div>
                <div>
                  <Label className="text-gray-700">Price (&#8377;) *</Label>
                  <Input name="price" type="number" value={formData.price} onChange={handleInputChange} placeholder="0.00" min="0" step="0.01" className="mt-2 bg-gray-100 border-gray-300 text-gray-900" required />
                </div>
                <div>
                  <Label className="text-gray-700">Discount</Label>
                  <div className="flex gap-2 mt-2">
                    <Input name="discount" type="number" value={formData.discount} onChange={handleInputChange} placeholder="0" min="0" step="0.1" className="flex-1 bg-gray-100 border-gray-300 text-gray-900" />
                    <Select value={formData.discountType} onValueChange={(val) => setFormData((prev) => ({ ...prev, discountType: val as any }))}>
                      <SelectTrigger className="w-20 bg-gray-100 border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="amount">&#8377;</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Auto-calculated from prices</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-700">Stock</Label>
                  <Input name="stock" type="number" value={formData.stock} onChange={handleInputChange} placeholder="0" min="0" className="mt-2 bg-gray-100 border-gray-300 text-gray-900" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-gray-700">Weight</Label>
                  <div className="flex gap-2 mt-2">
                    <Input name="weight" type="number" value={formData.weight} onChange={handleInputChange} placeholder="e.g., 100" min="0" step="0.01" className="flex-1 bg-gray-100 border-gray-300 text-gray-900" />
                    <Select value={formData.weightUnit} onValueChange={(val) => setFormData((prev) => ({ ...prev, weightUnit: val as 'grams' | 'kgs' }))}>
                      <SelectTrigger className="w-28 bg-gray-100 border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="grams">Grams</SelectItem>
                        <SelectItem value="kgs">Kilograms</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Specifications – dynamic */}
          <Card className="bg-white border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-gray-900">Specifications</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addSpecRow} className="text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Field
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {specifications.map((spec, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input value={spec.label} onChange={(e) => handleSpecChange(idx, 'label', e.target.value)} placeholder="Label (e.g., Material)" className="bg-gray-100 border-gray-300 text-gray-900 text-sm" />
                  </div>
                  <div className="flex-[2] relative">
                    <Input value={spec.value} onChange={(e) => handleSpecChange(idx, 'value', e.target.value)} placeholder="Value (e.g., Silver)" className="bg-gray-100 border-gray-300 text-gray-900 text-sm" list={'spec-suggestions-' + idx} />
                    {spec.label && specSuggestions[spec.label.toLowerCase().trim()] && (
                      <datalist id={'spec-suggestions-' + idx}>
                        {specSuggestions[spec.label.toLowerCase().trim()].map((s, si) => (
                          <option key={si} value={s} />
                        ))}
                      </datalist>
                    )}
                  </div>
                  {specifications.length > 1 && (
                    <button type="button" onClick={() => removeSpecRow(idx)} className="p-2 text-red-400 hover:text-red-600 mt-0.5">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <p className="text-xs text-gray-500">Previously entered values will appear as suggestions.</p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:space-y-6">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-gray-700">Active</Label>
                <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-700">Featured</Label>
                <Switch checked={formData.isFeatured} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isFeatured: checked }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-700">New Arrival</Label>
                <Switch checked={formData.isNewArrival} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isNewArrival: checked }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-gray-700">Best Seller</Label>
                <Switch checked={formData.isBestSeller} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isBestSeller: checked }))} />
              </div>
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Shop Flags</p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-700">Top Deal</Label>
                    <Switch checked={formData.isTopDeal} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isTopDeal: checked }))} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-700">Trend Product</Label>
                    <Switch checked={formData.isTrendProduct} onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isTrendProduct: checked }))} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="lg:col-span-3">
          <div className="flex gap-3">
            <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-8" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : isEditing ? 'Update Product' : 'Create Product'}
            </Button>
            <Button type="button" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-200 hover:text-gray-900 px-8" onClick={() => navigate('/admin/products')}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
