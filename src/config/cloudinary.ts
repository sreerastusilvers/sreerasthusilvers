// Cloudinary configuration
export const cloudinaryConfig = {
  cloudName: "doxwyrp8n",
  uploadPreset: "sreerasthusilvers",
};

// Cloudinary upload URL
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`;

// Helper to generate optimized image URLs
export const getOptimizedImageUrl = (url: string, options?: {
  width?: number;
  height?: number;
  quality?: string;
  format?: string;
}) => {
  if (!url || !url.includes('cloudinary')) return url;
  
  const { width, height, quality = 'auto', format = 'auto' } = options || {};
  
  // Insert transformations after /upload/
  const transformations = [
    `f_${format}`,
    `q_${quality}`,
    width && `w_${width}`,
    height && `h_${height}`,
    'c_limit'
  ].filter(Boolean).join(',');
  
  return url.replace('/upload/', `/upload/${transformations}/`);
};
