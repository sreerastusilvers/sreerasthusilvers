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

/**
 * Longest edge we keep for an uploaded master, in pixels.
 *
 * The largest size we ever deliver is 1600px (the `zoom` preset), so storing a
 * 4000px original just burns storage credits - a 3MB DSLR frame costs ~0.003
 * credits/month to store and buys nothing. 2000px leaves headroom above the
 * delivery ceiling without paying for pixels no customer will see.
 */
const MAX_UPLOAD_EDGE = 2000;
const RECOMPRESS_QUALITY = 0.85;

/**
 * Downscale an oversized image in the browser before upload. Returns the
 * original file untouched for videos, non-raster formats, or images already
 * within the cap.
 */
const downscaleImage = async (file: File): Promise<File> => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // unsupported/corrupt - let Cloudinary decide
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_UPLOAD_EDGE) {
    bitmap.close();
    return file;
  }

  const scale = MAX_UPLOAD_EDGE / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', RECOMPRESS_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
};

// Upload a single file to Cloudinary
export const uploadToCloudinary = async (
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<CloudinaryUploadResult> => {
  const upload = await downscaleImage(file);

  const formData = new FormData();
  formData.append('file', upload);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);

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

// NOTE: delivery-URL building lives in src/lib/cloudinaryUrl.ts. Two unused
// copies of that logic used to live here; render through <SmartImage> instead.
