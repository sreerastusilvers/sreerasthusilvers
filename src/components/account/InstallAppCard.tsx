import { useState } from 'react';
import { Download, Share, SquarePlus, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { usePwaInstall } from '@/lib/pwaInstall';
import { cn } from '@/lib/utils';

interface InstallAppCardProps {
  className?: string;
}

/**
 * "Install app" option. Lives on the account page only. Renders nothing when the
 * browser can't install, or when the site is already running as an installed app.
 */
const InstallAppCard = ({ className }: InstallAppCardProps) => {
  const { canPrompt, installed, isIOS, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  if (installed || (!canPrompt && !isIOS)) return null;

  const handleInstall = async () => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') toast.success('Sreerasthu Silvers is being added to your device');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Install the app"
      className={cn('rounded-lg bg-card p-4 shadow-sm border border-border/50', className)}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Smartphone className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold leading-tight text-foreground">Get the Sreerasthu app</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add Sreerasthu Silvers to your home screen for quicker access to your orders and new designs.
          </p>

          {canPrompt ? (
            <button
              type="button"
              onClick={handleInstall}
              disabled={busy}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Install app
            </button>
          ) : (
            <ol className="mt-3 space-y-2 text-sm text-foreground">
              <li className="flex min-h-[44px] items-center gap-3 rounded-lg bg-muted px-3">
                <Share className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Tap <strong className="font-semibold">Share</strong> in Safari
                </span>
              </li>
              <li className="flex min-h-[44px] items-center gap-3 rounded-lg bg-muted px-3">
                <SquarePlus className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                <span>
                  Then choose <strong className="font-semibold">Add to Home Screen</strong>
                </span>
              </li>
            </ol>
          )}
        </div>
      </div>
    </section>
  );
};

export default InstallAppCard;
