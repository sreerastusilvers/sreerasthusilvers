import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Video, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  uploadToCloudinary,
  validateFile,
  UploadProgress,
  CloudinaryUploadResult,
} from '@/services/cloudinaryService';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
  publicId: string;
  uploadedAt: Date;
}

const Media = () => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const newItems: MediaItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');

        // Validate file
        const validation = validateFile(file, {
          maxSizeMB: isVideo ? 50 : 10,
          allowedTypes: isVideo
            ? ['video/mp4', 'video/webm']
            : ['image/jpeg', 'image/png', 'image/webp'],
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

        newItems.push({
          url: result.secure_url,
          type: isVideo ? 'video' : 'image',
          publicId: result.public_id,
          uploadedAt: new Date(),
        });
      }

      setMediaItems((prev) => [...newItems, ...prev]);

      toast({
        title: 'Success',
        description: `${newItems.length} file(s) uploaded successfully`,
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload files',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
      toast({
        title: 'Copied',
        description: 'URL copied to clipboard',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy URL',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (url: string) => {
    setMediaItems((prev) => prev.filter((item) => item.url !== url));
    toast({
      title: 'Removed',
      description: 'Media removed from library',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
        <p className="text-gray-600 mt-1">Upload and manage your media files</p>
      </div>

      {/* Upload Section */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Upload Media</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-amber-600 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {uploading ? (
                <>
                  <Loader2 className="h-12 w-12 animate-spin text-amber-600 mb-4" />
                  <p className="text-lg text-gray-700">Uploading... {uploadProgress}%</p>
                  <div className="w-64 h-2 bg-gray-100 rounded-full mt-4">
                    <div
                      className="h-full bg-amber-600 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-600 mb-4" />
                  <p className="text-lg text-gray-700 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-500">
                    Images (JPG, PNG, WebP) up to 10MB
                  </p>
                  <p className="text-sm text-gray-500">Videos (MP4, WebM) up to 50MB</p>
                </>
              )}
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              multiple
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </CardContent>
      </Card>

      {/* Media Grid */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">
            Uploaded Media ({mediaItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mediaItems.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {mediaItems.map((item, index) => (
                <div
                  key={index}
                  className="relative group rounded-lg overflow-hidden bg-gray-100"
                >
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt={`Media ${index + 1}`}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                      <Video className="h-12 w-12 text-gray-400" />
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleCopyUrl(item.url)}
                      className="p-2 bg-amber-600 rounded-lg text-white hover:bg-amber-700 transition-colors"
                      title="Copy URL"
                    >
                      {copiedUrl === item.url ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(item.url)}
                      className="p-2 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Type Badge */}
                  <div className="absolute top-2 left-2">
                    <span className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      {item.type === 'image' ? (
                        <ImageIcon className="h-3 w-3" />
                      ) : (
                        <Video className="h-3 w-3" />
                      )}
                      {item.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ImageIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No media uploaded</h3>
              <p className="text-gray-600">Upload images and videos to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cloudinary Info */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Cloudinary Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Cloud Name:</span>
            <span className="text-gray-900 font-mono">doxwyrp8n</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Upload Preset:</span>
            <span className="text-gray-900 font-mono">sreerasthusilvers</span>
          </div>
          <p className="text-gray-500 text-xs mt-4">
            All uploaded media is stored securely on Cloudinary CDN and optimized for fast
            delivery.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Media;
