/**
 * Picks a template header picture, shrinks it to a JPEG within the store's
 * 500 KB limit and uploads it. The URL becomes Meta's review sample and the
 * picture sent with every message that uses the template.
 */
import { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { describeUploadError } from '@/services/mediaStorage';
import { uploadTemplatePicture } from './waMedia';

export default function TemplatePictureField({
  imageUrl,
  onChange,
  error,
}: {
  imageUrl: string | null;
  onChange: (url: string | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const helpId = useId();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      onChange(await uploadTemplatePicture(file));
    } catch (err) {
      setUploadError(describeUploadError(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const message = uploadError || error;
  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        id="tpl-header-imageUrl"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-describedby={helpId}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {imageUrl ? (
        <div className="flex items-center gap-3">
          <img src={imageUrl} alt="Header picture" className="h-16 w-28 flex-none rounded-lg border border-gray-200 object-cover dark:border-gray-700" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="mc-pic-btn">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
              Change
            </button>
            <button type="button" onClick={() => onChange(null)} disabled={busy} className="mc-pic-btn">
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-invalid={!!message}
          className="flex min-h-[72px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 text-sm font-medium text-gray-700 transition-colors hover:border-amber-400 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60 aria-[invalid=true]:border-red-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-amber-500/60 dark:hover:bg-amber-500/10"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
          {busy ? 'Uploading…' : 'Choose a picture'}
        </button>
      )}
      <p id={helpId} className="text-[11px] text-gray-500 dark:text-gray-400">
        JPEG or PNG; it is resized to fit. Wide pictures (about 1.91 : 1) look best. This picture goes with every message
        sent with this template.
      </p>
      {message && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {message}
        </p>
      )}
      <style>{`
        .mc-pic-btn { display: inline-flex; align-items: center; gap: 0.375rem; min-height: 36px; padding: 0 0.75rem; border-radius: 9999px; border: 1px solid #e5e7eb; font-size: 0.75rem; font-weight: 500; color: #374151; background: white; }
        .mc-pic-btn:hover:not(:disabled) { background: #f9fafb; }
        .mc-pic-btn:focus-visible { outline: 2px solid #f59e0b; outline-offset: 2px; }
        .mc-pic-btn:disabled { opacity: 0.6; }
        .dark .mc-pic-btn { border-color: #374151; color: #e5e7eb; background: #111827; }
        .dark .mc-pic-btn:hover:not(:disabled) { background: #1f2937; }
      `}</style>
    </div>
  );
}
