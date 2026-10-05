import { useState } from 'react';
import type { Area } from 'react-easy-crop';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { uploadImage, deleteMedia, describeUploadError } from '@/services/mediaStorage';
import { canEncodeWebp } from '@/lib/imageCompressor';
import { AVATAR_EDGE, isCustomAvatarUrl } from './avatarUtils';

/** Phones take 5-15 MB photos; anything past this is almost certainly not a photo. */
export const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This photo could not be opened. Please choose a JPG, PNG or WebP image.'));
    image.src = src;
  });

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Draw the cropped square at 400x400 (or smaller, never upscaled) and encode it
 * as WebP, or JPEG where the browser can't encode WebP (older Safari). A
 * 400px WebP is typically 15-40 KB, far under the 500 KB upload limit, and
 * re-encoding drops the EXIF data (GPS location) that phone photos carry.
 */
export const renderAvatarFile = async (imageSrc: string, crop: Area): Promise<File> => {
  const image = await loadImage(imageSrc);
  const edge = Math.max(1, Math.min(AVATAR_EDGE, Math.round(crop.width)));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = edge;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process this photo.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, edge, edge);

  const webp = (await canEncodeWebp()) ? await toBlob(canvas, 'image/webp', 0.86) : null;
  const blob = webp ?? (await toBlob(canvas, 'image/jpeg', 0.88));
  if (!blob) throw new Error('Your browser could not process this photo.');
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `profile-photo.${ext}`, { type: blob.type });
};

/** Upload, replace and remove the signed-in customer's profile photo. */
export const useProfilePhoto = () => {
  const { user, userProfile, setAvatar } = useAuth();
  const [busy, setBusy] = useState<'uploading' | 'removing' | null>(null);

  const previous = isCustomAvatarUrl(userProfile?.avatar) ? userProfile!.avatar! : null;

  /** Crop, shrink, upload through /api/media (R2, per-user folder) and save. */
  const save = async (imageSrc: string, crop: Area): Promise<boolean> => {
    if (!user) return false;
    setBusy('uploading');
    try {
      const file = await renderAvatarFile(imageSrc, crop);
      const uploaded = await uploadImage(file, { category: 'avatars', autoCompress: true });
      await setAvatar(uploaded.url);
      // Old upload is only removed once the new one is saved. Never throws.
      if (previous && previous !== uploaded.url) void deleteMedia([previous]);
      toast.success('Profile photo updated');
      return true;
    } catch (error) {
      console.error('Profile photo upload failed:', error);
      toast.error(describeUploadError(error));
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Drop the uploaded photo: falls back to the Google photo, then initials. */
  const remove = async (): Promise<boolean> => {
    if (!user || !previous) return false;
    setBusy('removing');
    try {
      await setAvatar(null);
      void deleteMedia([previous]);
      toast.success('Profile photo removed');
      return true;
    } catch (error) {
      console.error('Profile photo removal failed:', error);
      toast.error('Could not remove the photo. Please try again.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  return { save, remove, busy, hasCustomPhoto: !!previous };
};
