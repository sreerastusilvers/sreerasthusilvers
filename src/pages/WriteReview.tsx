import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, X, Loader2, Camera, Video, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  createReview, 
  uploadReviewImages, 
  uploadReviewVideo,
  hasUserPurchasedProduct 
} from '@/services/reviewService';
import { toast } from 'sonner';

interface LocationState {
  productId: string;
  productName: string;
  productImage: string;
}

const WriteReview = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { productId, productName, productImage } = (location.state as LocationState) || {};
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Verify user has purchased the product
    const verifyPurchase = async () => {
      if (!user || !productId) {
        navigate('/');
        return;
      }
      
      const hasPurchased = await hasUserPurchasedProduct(user.uid, productId);
      if (!hasPurchased) {
        toast.error('You need to purchase this product before writing a review');
        navigate(`/product/${productId}`);
      }
    };
    
    verifyPurchase();
  }, [user, productId, navigate]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (images.length + files.length > 4) {
      toast.error('You can upload up to 4 images only');
      return;
    }
    
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isUnder5MB = file.size <= 5 * 1024 * 1024;
      
      if (!isImage) toast.error(`${file.name} is not an image`);
      if (!isUnder5MB) toast.error(`${file.name} is larger than 5MB`);
      
      return isImage && isUnder5MB;
    });
    
    setImages(prev => [...prev, ...validFiles]);
    
    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isVideo = file.type.startsWith('video/');
    const isUnder200MB = file.size <= 200 * 1024 * 1024;
    
    if (!isVideo) {
      toast.error('Please upload a video file');
      return;
    }
    
    if (!isUnder200MB) {
      toast.error('Video must be under 200MB');
      return;
    }
    
    setVideo(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setVideoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setVideo(null);
    setVideoPreview('');
  };

  const getRatingText = () => {
    if (rating === 0) return '';
    if (rating === 1) return 'Was Poor!';
    if (rating === 2) return 'Was Fair!';
    if (rating === 3) return 'Was Good!';
    if (rating === 4) return 'Very Good!';
    if (rating === 5) return 'Excellent!';
    return '';
  };

  const handleSubmit = async () => {
    if (!user || !productId) {
      toast.error('Please login to submit a review');
      return;
    }
    
    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    
    if (!reviewText.trim()) {
      toast.error('Please write your review');
      return;
    }
    
    try {
      setUploading(true);
      
      // Upload images (gracefully handle CORS/upload failures)
      let imageUrls: string[] = [];
      if (images.length > 0) {
        try {
          imageUrls = await uploadReviewImages(images, user.uid, productId);
        } catch (uploadError) {
          console.warn('Image upload failed, submitting review without images:', uploadError);
          toast.error('Images could not be uploaded, but your review will still be submitted.');
        }
      }
      
      // Upload video (gracefully handle failures)
      let videoUrl: string | undefined;
      if (video) {
        try {
          videoUrl = await uploadReviewVideo(video, user.uid, productId);
        } catch (uploadError) {
          console.warn('Video upload failed, submitting review without video:', uploadError);
          toast.error('Video could not be uploaded, but your review will still be submitted.');
        }
      }
      
      // Create review
      await createReview({
        productId,
        productName: productName || 'Product',
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        userEmail: user.email || '',
        rating,
        reviewText: reviewText.trim(),
        images: imageUrls,
        ...(videoUrl ? { videoUrl } : {}),
        isVerifiedPurchase: true,
        status: 'pending', // Will be approved by admin
      });
      
      // Navigate to thank you page
      navigate('/thank-you-review', {
        state: {
          productId,
          productName,
          productImage,
        }
      });
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (!productId || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-4 py-4 border-b flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-700"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Write a Review</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Product Card */}
        <div className="flex items-center gap-3 py-2">
          <img
            src={productImage}
            alt={productName}
            className="w-16 h-16 object-cover rounded-xl"
          />
          <div>
            <h2 className="font-semibold text-base">{productName}</h2>
            <p className="text-sm text-gray-500">Share your experience</p>
          </div>
        </div>

        {/* Rate this product */}
        <div className="py-4">
          <h3 className="font-semibold mb-3">Rate this product</h3>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  size={44}
                  strokeWidth={1.5}
                  className={`${
                    star <= (hoverRating || rating)
                      ? 'fill-gray-300 text-gray-400'
                      : 'fill-none text-gray-300'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Write a Review */}
        <div className="py-4">
          <h3 className="font-semibold mb-3">Write a Review</h3>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Add description about the product"
            className="w-full h-32 p-4 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-gray-300 text-sm"
            maxLength={1000}
          />
        </div>

        {/* Photos & Video */}
        <div className="py-2">
          <div className="space-y-3 mb-4">
            <h4 className="font-semibold text-sm">Photos & Video</h4>
            <p className="text-xs text-gray-500">Capture and add your product experience!</p>

            {/* Upload Buttons Side by Side */}
            <div className="grid grid-cols-2 gap-3">
              {/* Add Photos Button */}
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={images.length >= 4}
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-400 transition-colors h-full">
                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                    <Camera size={20} className="text-gray-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">Add photos</p>
                    <p className="text-xs text-gray-500">(Up to 4)</p>
                  </div>
                </div>
              </label>

              {/* Add Video Button */}
              <label className="block">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  disabled={!!video}
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-400 transition-colors h-full">
                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                    <Video size={20} className="text-gray-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">Add a video</p>
                    <p className="text-xs text-gray-500">(1 min | 200 mb)</p>
                  </div>
                </div>
              </label>
            </div>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-1 -right-1 bg-black text-white rounded-full p-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Video Preview */}
            {videoPreview && (
              <div className="relative">
                <video
                  src={videoPreview}
                  controls
                  className="w-full max-h-48 rounded-lg"
                />
                <button
                  onClick={removeVideo}
                  className="absolute top-2 right-2 bg-black text-white rounded-full p-1"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={uploading || rating === 0 || !reviewText.trim()}
          className="w-full bg-gray-300 text-gray-600 py-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-6"
        >
          {uploading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Submitting...
            </>
          ) : (
            <>
              Submit ➜
            </>
          )}
        </button>

        <p className="text-xs text-center text-gray-500 mt-4 leading-relaxed">
          By submitting this review, you give us consent to{' '}
          <span className="text-black underline">publish</span> and{' '}
          <span className="text-black underline">promote</span> it in accordance with{' '}
          <span className="text-blue-600 underline">Terms Of Use</span> and{' '}
          <span className="text-blue-600 underline">Privacy Policy</span>.
        </p>
      </div>
    </div>
  );
};

export default WriteReview;
