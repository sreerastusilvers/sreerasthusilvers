import { useCallback, useEffect, useRef, useState } from 'react';
import { zipSync } from 'fflate';
import { Archive, Check, Download, ImageDown, Loader2, Trash2, Upload, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { compressImage, outputName, canEncodeWebp, type OutputFormat } from '@/lib/imageCompressor';
import { formatBytes, MAX_IMAGE_BYTES, MAX_BANNER_BYTES } from '@/services/mediaStorage';

/**
 * Admin tool: shrink a batch of photos under the upload limit at the best
 * quality possible, then download them (one by one or as a ZIP) to upload.
 * Everything runs in the browser - nothing is uploaded from this page.
 */

type Status = 'waiting' | 'working' | 'done' | 'error';

interface Item {
  id: string;
  file: File;
  previewUrl: string;
  status: Status;
  result?: { blob: Blob; url: string; width: number; height: number; quality: number | null; keptOriginal: boolean };
  error?: string;
}

const TARGETS = [
  { bytes: MAX_IMAGE_BYTES, label: '500 KB', hint: 'Products, gallery, collections, everything else' },
  { bytes: MAX_BANNER_BYTES, label: '1 MB', hint: 'Hero banners only' },
];

const ACCEPT = 'image/jpeg,image/png,image/webp';

const AdminImageCompressor = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [targetBytes, setTargetBytes] = useState(MAX_IMAGE_BYTES);
  const [format, setFormat] = useState<OutputFormat>('webp');
  const [webpOk, setWebpOk] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [zipping, setZipping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const runningRef = useRef(false);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    canEncodeWebp().then((ok) => {
      setWebpOk(ok);
      if (!ok) setFormat('jpeg');
    });
  }, []);

  // Free object URLs when the page closes.
  useEffect(() => () => {
    itemsRef.current.forEach((it) => {
      URL.revokeObjectURL(it.previewUrl);
      if (it.result) URL.revokeObjectURL(it.result.url);
    });
  }, []);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  /** Works through every waiting item, one at a time so the page stays responsive. */
  const processQueue = useCallback(async (bytes: number, fmt: OutputFormat) => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find((it) => it.status === 'waiting');
        if (!next) break;
        update(next.id, { status: 'working' });
        try {
          // Hero banners span the full screen width, so they keep more pixels (2x a 1440px screen).
          const maxEdge = bytes > MAX_IMAGE_BYTES ? 3200 : 2400;
          const r = await compressImage(next.file, { maxBytes: bytes, format: fmt, maxEdge });
          update(next.id, { status: 'done', result: { ...r, url: URL.createObjectURL(r.blob) }, error: undefined });
        } catch (e) {
          update(next.id, { status: 'error', error: e instanceof Error ? e.message : 'Could not compress this image.' });
        }
        // Let React commit before picking the next item.
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      runningRef.current = false;
    }
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const images = list.filter((f) => ACCEPT.split(',').includes(f.type));
    if (images.length < list.length) {
      toast.error(`${list.length - images.length} file(s) skipped — only JPG, PNG and WebP images are supported.`);
    }
    if (!images.length) return;
    const fresh: Item[] = images.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'waiting',
    }));
    itemsRef.current = [...itemsRef.current, ...fresh];
    setItems(itemsRef.current);
    processQueue(targetBytes, format);
  };

  /** Changing the target or format re-runs every image with the new settings. */
  const changeSettings = (bytes: number, fmt: OutputFormat) => {
    if (runningRef.current) {
      toast.message('Please wait for the current batch to finish, then change the setting.');
      return;
    }
    setTargetBytes(bytes);
    setFormat(fmt);
    const reset = itemsRef.current.map((it) => {
      if (it.result) URL.revokeObjectURL(it.result.url);
      return { ...it, status: 'waiting' as Status, result: undefined, error: undefined };
    });
    itemsRef.current = reset;
    setItems(reset);
    if (reset.length) processQueue(bytes, fmt);
  };

  const remove = (id: string) => {
    const it = itemsRef.current.find((x) => x.id === id);
    if (it) {
      URL.revokeObjectURL(it.previewUrl);
      if (it.result) URL.revokeObjectURL(it.result.url);
    }
    itemsRef.current = itemsRef.current.filter((x) => x.id !== id);
    setItems(itemsRef.current);
  };

  const clearAll = () => {
    if (runningRef.current) return;
    itemsRef.current.forEach((it) => {
      URL.revokeObjectURL(it.previewUrl);
      if (it.result) URL.revokeObjectURL(it.result.url);
    });
    itemsRef.current = [];
    setItems([]);
  };

  const done = items.filter((it) => it.status === 'done' && it.result);
  const busy = items.some((it) => it.status === 'waiting' || it.status === 'working');
  const originalTotal = done.reduce((n, it) => n + it.file.size, 0);
  const outputTotal = done.reduce((n, it) => n + it.result!.blob.size, 0);

  const downloadOne = (it: Item) => {
    if (!it.result) return;
    const a = document.createElement('a');
    a.href = it.result.url;
    a.download = outputName(it.file.name, it.result.blob, new Set());
    a.click();
  };

  const downloadZip = async () => {
    if (!done.length) return;
    setZipping(true);
    try {
      const taken = new Set<string>();
      const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
      for (const it of done) {
        const name = outputName(it.file.name, it.result!.blob, taken);
        // Images are already compressed, so store them as-is (level 0) - zipping is instant.
        entries[name] = [new Uint8Array(await it.result!.blob.arrayBuffer()), { level: 0 }];
      }
      const zip = zipSync(entries);
      const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `compressed-images-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(`Downloaded ${done.length} image${done.length > 1 ? 's' : ''} as a ZIP`);
    } catch (e) {
      console.error('[compressor] zip failed', e);
      toast.error('Could not create the ZIP. Try downloading the images one by one.');
    } finally {
      setZipping(false);
    }
  };

  const chip = (active: boolean) =>
    `text-left px-3 py-2 rounded-lg border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
      active ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-[#F5EFE6] bg-white text-gray-600 hover:border-amber-400 hover:text-amber-700'
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ImageDown className="h-7 w-7 text-amber-600" />
          Image Compressor
        </h1>
        <p className="text-gray-500 text-sm mt-1 max-w-2xl">
          Shrinks photos below the upload limit at the highest quality possible, then downloads them as a ZIP for
          uploading. Photos stay on this computer — nothing is uploaded from this page.
        </p>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-[#F5EFE6] p-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Size limit</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Size limit">
            {TARGETS.map((t) => (
              <button
                key={t.bytes}
                type="button"
                role="radio"
                aria-checked={targetBytes === t.bytes}
                onClick={() => targetBytes !== t.bytes && changeSettings(t.bytes, format)}
                className={chip(targetBytes === t.bytes)}
              >
                <span className="block text-sm font-semibold">Under {t.label}</span>
                <span className="block text-[11px] opacity-80 mt-0.5">{t.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Format</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Output format">
            <button
              type="button"
              role="radio"
              aria-checked={format === 'webp'}
              disabled={!webpOk}
              onClick={() => format !== 'webp' && changeSettings(targetBytes, 'webp')}
              className={`${chip(format === 'webp')} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="block text-sm font-semibold">WebP (recommended)</span>
              <span className="block text-[11px] opacity-80 mt-0.5">
                {webpOk ? 'Sharpest result for the size' : 'Not supported in this browser — use Chrome or Edge'}
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={format === 'jpeg'}
              onClick={() => format !== 'jpeg' && changeSettings(targetBytes, 'jpeg')}
              className={chip(format === 'jpeg')}
            >
              <span className="block text-sm font-semibold">JPG</span>
              <span className="block text-[11px] opacity-80 mt-0.5">Works everywhere, slightly softer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`w-full border-2 border-dashed rounded-xl px-6 py-10 flex flex-col items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
          dragOver ? 'border-amber-500 bg-amber-50' : 'border-amber-300 bg-white hover:border-amber-500 hover:bg-[#FFF9E6]/40'
        }`}
      >
        <Upload className="h-8 w-8 text-amber-500" />
        <span className="text-sm font-semibold text-gray-800">Drop photos here or click to choose</span>
        <span className="text-xs text-gray-500">JPG, PNG or WebP · select as many as you like</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-[#F5EFE6] overflow-hidden">
          {/* Summary + actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-[#F5EFE6]">
            <div className="text-sm text-gray-700" aria-live="polite">
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                  Compressing {done.length + 1} of {items.length}…
                </span>
              ) : (
                <span>
                  <strong>{done.length}</strong> of {items.length} ready
                  {done.length > 0 && (
                    <> · {formatBytes(originalTotal)} → <strong>{formatBytes(outputTotal)}</strong></>
                  )}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearAll} disabled={busy}>
                <Trash2 className="h-4 w-4 mr-1.5" /> Clear all
              </Button>
              <Button
                size="sm"
                onClick={downloadZip}
                disabled={busy || zipping || done.length === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {zipping ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Archive className="h-4 w-4 mr-1.5" />}
                Download all as ZIP
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-[#F5EFE6]">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-4 px-5 py-3">
                <img
                  src={it.result?.url || it.previewUrl}
                  alt=""
                  className="h-14 w-14 rounded-lg object-cover bg-gray-100 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate" title={it.file.name}>{it.file.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                    {formatBytes(it.file.size)}
                    {it.result && (
                      <>
                        {' → '}
                        <span className="font-semibold text-gray-800">{formatBytes(it.result.blob.size)}</span>
                        {' · '}{it.result.width}×{it.result.height}
                        {it.result.keptOriginal
                          ? ' · already under the limit, kept untouched'
                          : ` · quality ${Math.round((it.result.quality ?? 0) * 100)}%`}
                      </>
                    )}
                  </p>
                  {it.status === 'error' && (
                    <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {it.error}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {it.status === 'waiting' && <span className="text-xs text-gray-400">Waiting</span>}
                  {it.status === 'working' && <Loader2 className="h-4 w-4 animate-spin text-amber-600" aria-label="Compressing" />}
                  {it.status === 'done' && (
                    <>
                      <Check className="h-4 w-4 text-green-600" aria-label="Done" />
                      <button
                        type="button"
                        onClick={() => downloadOne(it)}
                        className="p-2 rounded-lg text-gray-500 hover:text-amber-700 hover:bg-amber-50"
                        aria-label={`Download ${it.file.name}`}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(it.id)}
                    disabled={it.status === 'working'}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                    aria-label={`Remove ${it.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AdminImageCompressor;
