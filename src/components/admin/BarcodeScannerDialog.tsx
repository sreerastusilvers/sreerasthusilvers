import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Camera barcode scanner for the admin panel.
 *
 * ZXing is loaded with a dynamic import so its ~200KB decoder never lands in
 * the storefront bundle — admins are the only ones who scan anything.
 *
 * Works on any browser that grants `getUserMedia`; note that browsers only hand
 * out the camera on https:// or http://localhost, so a plain-http LAN address
 * will report "camera unavailable".
 */

type ScannerControls = { stop: () => void };

interface BarcodeScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once with the decoded text; the dialog closes itself afterwards. */
  onDetected: (code: string) => void;
  title?: string;
  description?: string;
}

export const BarcodeScannerDialog = ({
  open,
  onOpenChange,
  onDetected,
  title = 'Scan barcode',
  description = 'Point the camera at the product barcode.',
}: BarcodeScannerDialogProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const detectedRef = useRef(false);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);

  const stop = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      // already stopped
    }
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }

    let cancelled = false;
    detectedRef.current = false;
    setError(null);
    setStarting(true);

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');

        // Enumerating cameras needs permission first on most browsers.
        const cams = await BrowserMultiFormatReader.listVideoInputDevices().catch(
          () => [] as MediaDeviceInfo[],
        );
        if (cancelled) return;
        setDevices(cams);

        // Prefer the rear camera on phones/tablets.
        const preferred =
          cams.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ??
          cams[deviceIndex]?.deviceId ??
          undefined;

        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoDevice(
          preferred,
          videoRef.current!,
          (result) => {
            if (!result || detectedRef.current) return;
            detectedRef.current = true;
            const text = result.getText().trim();
            stop();
            onDetected(text);
            onOpenChange(false);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e) {
        if (cancelled) return;
        const msg = (e as Error)?.message || '';
        setError(
          /permission|denied|NotAllowed/i.test(msg)
            ? 'Camera permission was blocked. Allow camera access for this site and try again.'
            : /NotFound|no video|Requested device/i.test(msg)
              ? 'No camera found on this device.'
              : 'Camera unavailable. Browsers only allow scanning on https:// or localhost — you can type the barcode instead.',
        );
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, deviceIndex, onDetected, onOpenChange, stop]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stop(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-amber-600" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-3/4 h-1/3 border-2 border-amber-400/80 rounded-lg" />
          </div>
          {starting && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 text-white text-sm gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting camera…
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-lg p-2.5">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          {devices.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeviceIndex((i) => (i + 1) % devices.length)}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Switch camera
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            <X className="w-3.5 h-3.5 mr-1.5" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScannerDialog;
