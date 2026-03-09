import { CLOUDINARY_UPLOAD_URL, cloudinaryConfig } from '@/config/cloudinary';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  resource_type: string;
  created_at: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Upload a single file to Cloudinary
export const uploadToCloudinary = async (
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<CloudinaryUploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  formData.append('cloud_name', cloudinaryConfig.cloudName);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.open('POST', CLOUDINARY_UPLOAD_URL);
    
    // Track upload progress
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
          });
        }
      };
    }
    
    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        resolve(response);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });
};

// Upload multiple files
export const uploadMultipleToCloudinary = async (
  files: File[],
  onProgress?: (index: number, progress: UploadProgress) => void
): Promise<CloudinaryUploadResult[]> => {
  const results: CloudinaryUploadResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const result = await uploadToCloudinary(files[i], (progress) => {
      onProgress?.(i, progress);
    });
    results.push(result);
  }
  
  return results;
};

// Delete from Cloudinary (requires server-side implementation for security)
// This is a placeholder - actual deletion should be done server-side
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  console.warn('Cloudinary deletion should be implemented server-side for security');
  // In production, call your backend API to delete the image
};

// Validate file before upload
export const validateFile = (file: File, options?: {
  maxSizeMB?: number;
  allowedTypes?: string[];
}): { valid: boolean; error?: string } => {
  const { maxSizeMB = 10, allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'] } = options || {};
  
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${allowedTypes.join(', ')}`,
    };
  }
  
  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${maxSizeMB}MB`,
    };
  }
  
  return { valid: true };
};

// Get optimized URL with transformations
export const getTransformedUrl = (
  url: string,
  transformations: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'limit';
    quality?: 'auto' | 'auto:low' | 'auto:eco' | 'auto:good' | 'auto:best';
    format?: 'auto' | 'webp' | 'jpg' | 'png';
  }
): string => {
  if (!url || !url.includes('cloudinary')) return url;
  
  const { width, height, crop = 'limit', quality = 'auto', format = 'auto' } = transformations;
  
  const transforms = [
    `f_${format}`,
    `q_${quality}`,
    `c_${crop}`,
    width && `w_${width}`,
    height && `h_${height}`,
  ].filter(Boolean).join(',');
  
  return url.replace('/upload/', `/upload/${transforms}/`);
};

// Generate thumbnail URL
export const getThumbnailUrl = (url: string, size = 200): string => {
  return getTransformedUrl(url, {
    width: size,
    height: size,
    crop: 'fill',
    quality: 'auto',
    format: 'auto',
  });
};
