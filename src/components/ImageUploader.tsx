import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  existingImageUrl?: string;
  existingFileName?: string;
  existingFileType?: 'pdf' | 'image';
  onRemove?: () => void;
  isUploading?: boolean;
  /** When true, also accept PDF files (used for refund receipts). */
  acceptPdf?: boolean;
}

const ImageUploader = ({
  onImageSelected,
  existingImageUrl,
  existingFileName,
  existingFileType,
  onRemove,
  isUploading,
  acceptPdf = false,
}: ImageUploaderProps) => {
  const [preview, setPreview] = useState<string | null>(existingImageUrl || null);
  const [previewKind, setPreviewKind] = useState<'pdf' | 'image'>(existingFileType || 'image');
  const [previewName, setPreviewName] = useState<string | null>(existingFileName || null);

  // Update preview when existing values change
  useEffect(() => {
    setPreview(existingImageUrl || null);
    setPreviewKind(existingFileType || 'image');
    setPreviewName(existingFileName || null);
  }, [existingImageUrl, existingFileType, existingFileName]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    console.log('onDrop called', { acceptedFiles, rejectedFiles });

    if (rejectedFiles.length > 0) {
      console.error('Files rejected:', rejectedFiles);
      rejectedFiles.forEach(rejection => {
        console.error('File:', rejection.file);
        console.error('Errors:', rejection.errors);
        rejection.errors.forEach((error: any) => {
          console.error(`Error code: ${error.code}, message: ${error.message}`);
        });
      });
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const isPdf = file.type === 'application/pdf';
      setPreviewKind(isPdf ? 'pdf' : 'image');
      setPreviewName(file.name);

      if (isPdf) {
        // No image preview for PDFs — show file card
        setPreview('pdf');
      } else {
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
      }

      onImageSelected(file);
    }
  }, [onImageSelected]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptPdf
      ? { 'image/*': [], 'application/pdf': ['.pdf'] }
      : { 'image/*': [] },
    maxFiles: 1,
    maxSize: 10485760, // 10MB
    noClick: false,
    noKeyboard: false,
  });

  console.log('ImageUploader render', { preview, isDragActive });

  const handleRemove = () => {
    setPreview(null);
    setPreviewName(null);
    setPreviewKind('image');
    onRemove?.();
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {preview ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full h-64 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-zinc-800"
          >
            {previewKind === 'pdf' ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-900 gap-3">
                <FileText className="w-16 h-16 text-red-500" />
                <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 max-w-[80%] truncate">
                  {previewName || 'document.pdf'}
                </p>
                <p className="text-xs text-gray-500">PDF document</p>
              </div>
            ) : (
              <img
                src={preview}
                alt="Banner preview"
                className="w-full h-full object-cover"
              />
            )}
            {!isUploading && (
              <button
                onClick={handleRemove}
                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              {...getRootProps()}
              className={`w-full h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                isDragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`w-12 h-12 mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                {isDragActive
                  ? acceptPdf ? 'Drop the file here' : 'Drop the image here'
                  : acceptPdf ? 'Drag & drop image or PDF' : 'Drag & drop banner image'}
              </p>
              <p className="text-xs text-gray-500 dark:text-zinc-500">or click to browse</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
                Max size: 10MB • {acceptPdf ? 'Images and PDF supported' : 'All image formats supported'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImageUploader;
