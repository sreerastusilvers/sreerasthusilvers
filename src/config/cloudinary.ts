// Cloudinary configuration
export const cloudinaryConfig = {
  cloudName: "dpphmsx1m",
  uploadPreset: "ssdatabase",
};

// Cloudinary upload URL
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/upload`;

// NOTE: URL optimization lives in src/lib/cloudinaryUrl.ts and is applied via
// the <SmartImage> component. A duplicate helper used to sit here with zero call
// sites, which is how full-resolution originals ended up being served to every
// product tile. Do not add another one - render through <SmartImage>.
