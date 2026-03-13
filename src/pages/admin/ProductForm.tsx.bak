import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Video,
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

const shopCategories = [
  'Top Deals',
  'Best Sellers',
  'Trend Products',
  'Jewellery',
  'Furniture',
  'Articles',
  'Other Products',
];

const specificCategories = [
  'Bracelets',
  'Necklaces',
  'Rings',
  'Jewelry',
];

const subcategoriesByCategory: Record<string, string[]> = {
  'Bracelets': ['Diamond', 'Gemstone', 'Pearl', 'Gold', 'Silver', 'Bangle'],
  'Necklaces': ['Diamond', 'Gemstone', 'Pearl', 'Gold', 'Silver', 'Cross'],
  'Rings': ['Diamond', 'Gemstone', 'Wedding', 'Engagement', 'Gold', 'Fashion'],
  'Jewelry': ['Men\'s Jewelry', 'Birthstone', 'Pearl', 'Rose Gold', 'New Arrivals', 'Sale'],
  'Jewellery': ['Necklaces', 'Rings', 'Bracelets', 'Anklets', 'Pendants', 'Earrings', 'Chains', 'Sets'],
  'Furniture': ['Silver Sofa Collection', 'Royal Silver Chairs', 'Royal Silver Tables', 'Antique Silver Décor', 'Silver Swing (Jhoola)'],
  'Articles': ['Silver Pooja Kalash Set', 'Silver Coconut', 'Silver Footwear', 'Silver Gopuram Idol Stand', 'Silver Camel Cart', 'Silver Jhula'],
  'Other Products': ['Silver Idols', 'Silver Pooja Items', 'Silver Gift Articles', 'Custom Engraved Items', 'Silver Coins', 'Limited Edition Pieces'],
};

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
  const [videoUploadMode, setVideoUploadMode] = useState<'upload' | 'url'>('upload');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    subcategory: '',
    description: '',
    tags: '',
    price: '',
    originalPrice: '',
    discount: '',
    rating: '',
    reviewCount: '',
    stock: '',
    weight: '',
    material: '',
    purity: '',
    dimensions: '',
    isActive: true,
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
  });

  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [thumbnail, setThumbnail] = useState<string>('');

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
          description: product.description,
          tags: '',
          price: product.price.toString(),
          originalPrice: product.originalPrice?.toString() || '',
          discount: product.discount?.toString() || '',
          rating: product.rating?.toString() || '',
          reviewCount: product.reviewCount?.toString() || '',
          stock: product.inventory?.stock?.toString() || '',
          weight: product.inventory?.weight || '',
          material: product.specifications?.material || '',
          purity: product.specifications?.purity || '',
          dimensions: product.specifications?.dimensions || '',
          isActive: product.flags?.isActive ?? true,
          isFeatured: product.flags?.isFeatured ?? false,
          isNewArrival: product.flags?.isNewArrival ?? false,
          isBestSeller: product.flags?.isBestSeller ?? false,
        });
        setImages(product.media?.images || []);
        setVideos(product.media?.videos || []);
        setThumbnail(product.media?.thumbnail || '');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch product details',
        variant: 'destructive',
      });
    } finally {
      setFetchingProduct(false);
    }
  };

  // Auto-toggle flags when Best Sellers or Trend Products category is selected
  useEffect(() => {
    if (formData.category === 'Best Sellers') {
      setFormData((prev) => ({ ...prev, isBestSeller: true }));
    } else if (formData.category === 'Trend Products') {
      setFormData((prev) => ({ ...prev, isNewArrival: true }));
    }
  }, [formData.category]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    setUploadProgress(0);

    try {
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file
        const validation = validateFile(file, {
          maxSizeMB: 10,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        });
        
        if (!validation.valid) {
          toast({
            title: 'Invalid File',
            description: validation.error,
            variant: 'destructive',
          });
          continue;
        }

        const result = await uploadToCloudinary(file, (progress: UploadProgress) => {
          setUploadProgress(
            Math.round(((i + progress.percentage / 100) / files.length) * 100)
          );
        });

        uploadedUrls.push(result.secure_url);
      }

      setImages((prev) => [...prev, ...uploadedUrls]);
      
      // Set first image as thumbnail if not set
      if (!thumbnail && uploadedUrls.length > 0) {
        setThumbnail(uploadedUrls[0]);
      }

      toast({
        title: 'Success',
        description: `${uploadedUrls.length} image(s) uploaded successfully`,
      });
    } catch (error) {
      console.error('Error uploading images:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload images',
        variant: 'destructive',
      });
    } finally {
      setUploadingImages(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = (url: string) => {
    setImages((prev) => prev.filter((img) => img !== url));
    if (thumbnail === url) {
      setThumbnail(images.find((img) => img !== url) || '');
    }
  };

  const handleSetThumbnail = (url: string) => {
    setThumbnail(url);
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    
    // Basic URL validation
    try {
      new URL(imageUrlInput);
      setImages((prev) => [...prev, imageUrlInput]);
      if (!thumbnail) {
        setThumbnail(imageUrlInput);
      }
      setImageUrlInput('');
      toast({
        title: 'Success',
        description: 'Image URL added successfully',
      });
    } catch (error) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
    }
  };

  const handleAddVideoUrl = () => {
    if (!videoUrlInput.trim()) return;
    
    // Basic URL validation
    try {
      new URL(videoUrlInput);
      setVideos((prev) => [...prev, videoUrlInput]);
      setVideoUrlInput('');
      toast({
        title: 'Success',
        description: 'Video URL added successfully',
      });
    } catch (error) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid video URL',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.category || !formData.price) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (images.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please upload at least one product image',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> = {
        name: formData.name,
        slug: generateSlug(formData.name),
        category: formData.category,
        subcategory: formData.subcategory,
        description: formData.description,
        price: parseFloat(formData.price),
        ...(formData.originalPrice && { originalPrice: parseFloat(formData.originalPrice) }),
        ...(formData.discount && { discount: parseFloat(formData.discount) }),
        ...(formData.rating && { rating: parseFloat(formData.rating) }),
        ...(formData.reviewCount && { reviewCount: parseFloat(formData.reviewCount) }),
        currency: 'INR',
        media: {
          images,
          videos,
          thumbnail: thumbnail || images[0],
        },
        inventory: {
          stock: parseInt(formData.stock) || 0,
          sku: '', // Auto-generated in backend
          weight: formData.weight,
        },
        specifications: {
          material: formData.material,
          purity: formData.purity,
          dimensions: formData.dimensions,
        },
        flags: {
          isActive: formData.isActive,
          isFeatured: formData.isFeatured,
          isNewArrival: formData.isNewArrival,
          isBestSeller: formData.isBestSeller,
        },
      } as any;

      console.log('ProductForm: Saving product with data:', productData);

      if (isEditing) {
        await updateProduct(productId!, productData);
        toast({
          title: 'Success',
          description: 'Product updated successfully',
        });
      } else {
        const newProductId = await createProduct(productData, user!.uid);
        console.log('ProductForm: Product created with ID:', newProductId);
        toast({
          title: 'Success',
          description: 'Product created successfully',
        });
      }

      navigate('/admin/products');
    } catch (error) {
      console.error('ProductForm: Error saving product:', error);
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} product`,
        variant: 'destructive',
      });
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/products')}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-gray-600 mt-1">
            {isEditing ? 'Update product details' : 'Add a new product to your catalog'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-gray-700">Product Name *</Label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter product name"
                  className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger className="mt-2 bg-gray-100 border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop</div>
                      {shopCategories.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-gray-900 pl-4">
                          {cat}
                        </SelectItem>
                      ))}
                      <div className="border-t border-gray-200 my-1"></div>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categories</div>
                      {specificCategories.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-gray-900 pl-4">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-gray-700">Subcategory</Label>
                  <Select
                    value={formData.subcategory}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, subcategory: value }))
                    }
                    disabled={!formData.category}
                  >
                    <SelectTrigger className="mt-2 bg-gray-100 border-gray-300 text-gray-900">
                      <SelectValue placeholder={formData.category ? "Select subcategory" : "Select category first"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-200">
                      {formData.category && subcategoriesByCategory[formData.category]?.map((subcat) => (
                        <SelectItem key={subcat} value={subcat} className="text-gray-900">
                          {subcat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-gray-700">Description</Label>
                <Textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter product description"
                  className="mt-2 bg-gray-100 border-gray-300 text-gray-900 min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Upload */}
              <div>
                <Label className="text-gray-700">Product Images *</Label>
                
                {/* Upload Mode Tabs */}
                <div className="flex gap-2 mt-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setImageUploadMode('upload')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      imageUploadMode === 'upload'
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    📤 Upload Files
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUploadMode('url')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      imageUploadMode === 'url'
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    🔗 Paste URL
                  </button>
                </div>

                {imageUploadMode === 'upload' ? (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-amber-600 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {uploadingImages ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-spin text-amber-600 mb-2" />
                          <p className="text-sm text-gray-600">
                            Uploading... {uploadProgress}%
                          </p>
                        </>
                      ) : (
                        <>
                          <Upload className="h-8 w-8 text-gray-600 mb-2" />
                          <p className="text-sm text-gray-600">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">
                            PNG, JPG, WebP up to 10MB
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={uploadingImages}
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                        className="flex-1 bg-white border-gray-300"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddImageUrl())}
                      />
                      <Button
                        type="button"
                        onClick={handleAddImageUrl}
                        className="bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Supports all image formats: JPG, PNG, GIF, WebP, BMP, SVG, AVIF, HEIC, HEIF, TIFF
                    </p>
                  </div>
                )}

                {/* Image Preview */}
                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    {images.map((url, index) => (
                      <div key={index} className="relative group">
                        <div className="w-full h-24 bg-gray-200 rounded-lg overflow-hidden">
                          <img
                            src={url}
                            alt={`Product ${index + 1}`}
                            className={`w-full h-full object-cover ${
                              thumbnail === url ? 'ring-2 ring-amber-500' : ''
                            }`}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector('.error-text')) {
                                const errorDiv = document.createElement('div');
                                errorDiv.className = 'error-text flex items-center justify-center h-full text-xs text-gray-500';
                                errorDiv.textContent = 'Failed to load';
                                parent.appendChild(errorDiv);
                              }
                            }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSetThumbnail(url)}
                            className="p-1 bg-amber-600 rounded text-white text-xs"
                            title="Set as thumbnail"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(url)}
                            className="p-1 bg-red-500 rounded text-white"
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        {thumbnail === url && (
                          <span className="absolute top-1 left-1 bg-amber-600 text-white text-xs px-1 rounded">
                            Thumb
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Video Upload */}
              <div>
                <Label className="text-gray-700">Product Videos (Optional)</Label>
                
                {/* Upload Mode Tabs */}
                <div className="flex gap-2 mt-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setVideoUploadMode('upload')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      videoUploadMode === 'upload'
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    📤 Upload Files
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoUploadMode('url')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                      videoUploadMode === 'url'
                        ? 'bg-gray-100 text-gray-900'
                        : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    🔗 Paste URL
                  </button>
                </div>

                {videoUploadMode === 'upload' ? (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-amber-600 transition-colors">
                    <div className="text-center">
                      <Video className="h-6 w-6 text-gray-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-500">Choose files</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="video/*"
                      multiple
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        value={videoUrlInput}
                        onChange={(e) => setVideoUrlInput(e.target.value)}
                        placeholder="https://example.com/video.mp4"
                        className="flex-1 bg-white border-gray-300"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVideoUrl())}
                      />
                      <Button
                        type="button"
                        onClick={handleAddVideoUrl}
                        className="bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        Add
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Supports all video formats: MP4, WebM, MOV, AVI, MKV, FLV, WMV, OGG
                    </p>
                  </div>
                )}

                {/* Video Preview */}
                {videos.length > 0 && (
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {videos.map((url, index) => (
                      <div key={index} className="relative group">
                        <video
                          src={url}
                          className="w-full h-24 object-cover rounded-lg bg-gray-100"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => setVideos((prev) => prev.filter((v) => v !== url))}
                            className="p-1 bg-red-500 rounded text-white"
                            title="Remove"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <Label className="text-gray-700">Tags (optional)</Label>
                <Input
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  placeholder="new, featured, bestseller (comma-separated)"
                  className="mt-2 bg-white border-gray-300 text-gray-900"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Inventory */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Pricing & Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700">Price (₹) *</Label>
                  <Input
                    name="price"
                    type="number"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <Label className="text-gray-700">Original Price (₹)</Label>
                  <Input
                    name="originalPrice"
                    type="number"
                    value={formData.originalPrice}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700">Discount (%)</Label>
                <Input
                  name="discount"
                  type="number"
                  value={formData.discount}
                  onChange={handleInputChange}
                  placeholder="e.g., 20 for 20% off"
                  min="0"
                  max="100"
                  step="1"
                  className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                />
                <p className="text-xs text-gray-500 mt-1">Optional: Add a discount percentage to display on product cards</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700">Rating</Label>
                  <Input
                    name="rating"
                    type="number"
                    value={formData.rating}
                    onChange={handleInputChange}
                    placeholder="e.g., 4.5"
                    min="0"
                    max="5"
                    step="0.1"
                    className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional: Rating out of 5</p>
                </div>

                <div>
                  <Label className="text-gray-700">Review Count</Label>
                  <Input
                    name="reviewCount"
                    type="number"
                    value={formData.reviewCount}
                    onChange={handleInputChange}
                    placeholder="e.g., 8"
                    min="0"
                    step="0.1"
                    className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional: Number of reviews</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-700">Stock</Label>
                  <Input
                    name="stock"
                    type="number"
                    value={formData.stock}
                    onChange={handleInputChange}
                    placeholder="0"
                    min="0"
                    className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>

                <div>
                  <Label className="text-gray-700">Weight</Label>
                  <Input
                    name="weight"
                    value={formData.weight}
                    onChange={handleInputChange}
                    placeholder="e.g., 10g"
                    className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Specifications */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Specifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-700">Material</Label>
                  <Input
                    name="material"
                    value={formData.material}
                    onChange={handleInputChange}
                    placeholder="e.g., Silver"
                    className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>

                <div>
                  <Label className="text-gray-700">Purity</Label>
                  <Input
                    name="purity"
                    value={formData.purity}
                    onChange={handleInputChange}
                    placeholder="e.g., 925"
                    className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>

                <div>
                  <Label className="text-gray-700">Dimensions</Label>
                  <Input
                    name="dimensions"
                    value={formData.dimensions}
                    onChange={handleInputChange}
                    placeholder="e.g., 5x3cm"
                    className="mt-2 bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-gray-700">Active</Label>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-gray-700">Featured</Label>
                <Switch
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isFeatured: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-gray-700">New Arrival</Label>
                <Switch
                  checked={formData.isNewArrival}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isNewArrival: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-gray-700">Best Seller</Label>
                <Switch
                  checked={formData.isBestSeller}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isBestSeller: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="lg:col-span-3 -mt-6">
          <div className="inline-block">
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    className="bg-amber-600 hover:bg-amber-700 px-8"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {isEditing ? 'Updating...' : 'Creating...'}
                      </>
                    ) : isEditing ? (
                      'Update Product'
                    ) : (
                      'Create Product'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 px-8"
                    onClick={() => navigate('/admin/products')}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
