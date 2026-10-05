/**
 * WhatsApp setup checklist for the admin inbox. Asks the server which env
 * vars are set (booleans only, never values) and maps each missing piece to
 * its step in docs/WHATSAPP_SETUP.md.
 */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, Loader2, RefreshCw, Settings2, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { whatsappAdminApi, type ConfigStatus } from '@/services/whatsappAdminApi';

type CheckKey = keyof ConfigStatus['env'] | 'webhookSeen';

const STEPS: Array<{ n: number; title: string; body: string; checks: CheckKey[] }> = [
  { n: 1, title: 'Create or choose the Meta app', body: 'developers.facebook.com → My Apps → Create app → type "Business" → connect it to the Sreerasthu Silvers business portfolio.', checks: [] },
  { n: 2, title: 'Add the WhatsApp product', body: 'In the app dashboard, find WhatsApp and press Set up. Meta creates a WhatsApp Business Account (WABA) for you.', checks: [] },
  { n: 3, title: 'Register the business phone number', body: 'WhatsApp → API Setup → Add phone number. Enter the display name and verify the number with the SMS or voice code.', checks: [] },
  { n: 4, title: 'Make a permanent token', body: 'business.facebook.com → Settings → Users → System users → Add (Admin). Assign the app and the WhatsApp account, then Generate token with whatsapp_business_messaging and whatsapp_business_management. Copy it once.', checks: ['WHATSAPP_TOKEN'] },
  { n: 5, title: 'Copy the Phone number ID and WABA ID', body: 'WhatsApp → API Setup shows "Phone number ID" and "WhatsApp Business Account ID" under the From number.', checks: ['WHATSAPP_PHONE_ID', 'WHATSAPP_WABA_ID'] },
  { n: 6, title: 'Add the values in Vercel and redeploy', body: 'vercel.com → project → Settings → Environment Variables. Add WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_WABA_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET (App settings → Basic → App secret) and FIREBASE_ADMIN_SDK_BASE64. Then Deployments → Redeploy.', checks: ['FIREBASE_ADMIN_SDK_BASE64', 'WHATSAPP_APP_SECRET'] },
  { n: 7, title: 'Connect the webhook', body: 'WhatsApp → Configuration → Webhook → Edit. Callback URL: https://<your domain>/api/whatsapp-webhook. Verify token: the same text as WHATSAPP_VERIFY_TOKEN. Verify and save, then Manage → subscribe to "messages".', checks: ['WHATSAPP_VERIFY_TOKEN'] },
  { n: 8, title: 'Create your first template', body: 'Admin → Marketing → Templates → Create new. Submit it and wait for "Approved" (press Sync from Meta to refresh).', checks: [] },
  { n: 9, title: 'Test the inbox', body: 'From your own phone, send "Hi" to the business number. It should appear here within seconds. Reply to it to check sending.', checks: ['webhookSeen'] },
];

const CHECK_LABEL: Record<CheckKey, string> = {
  WHATSAPP_TOKEN: 'Access token (WHATSAPP_TOKEN)',
  WHATSAPP_PHONE_ID: 'Phone number ID (WHATSAPP_PHONE_ID)',
  WHATSAPP_WABA_ID: 'Business account ID (WHATSAPP_WABA_ID)',
  WHATSAPP_VERIFY_TOKEN: 'Webhook verify token (WHATSAPP_VERIFY_TOKEN)',
  WHATSAPP_APP_SECRET: 'App secret (WHATSAPP_APP_SECRET)',
  FIREBASE_ADMIN_SDK_BASE64: 'Firebase admin key (FIREBASE_ADMIN_SDK_BASE64)',
  webhookSeen: 'A customer message has arrived',
};

type State = { loading: boolean; data: ConfigStatus | null; error: string | null };

export function useWhatsAppSetupStatus(demo: boolean) {
  const [state, setState] = useState<State>({ loading: !demo, data: null, error: null });
  const refresh = useCallback(async () => {
    if (demo) {
      setState({
        loading: false,
        error: null,
        data: {
          ok: true,
          env: { WHATSAPP_TOKEN: true, WHATSAPP_PHONE_ID: true, WHATSAPP_WABA_ID: false, WHATSAPP_VERIFY_TOKEN: true, WHATSAPP_APP_SECRET: true, FIREBASE_ADMIN_SDK_BASE64: true },
          webhookSeen: true,
        },
      });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await whatsappAdminApi.configStatus();
      setState({ loading: false, data, error: null });
    } catch (err) {
      setState({ loading: false, data: null, error: err instanceof Error ? err.message : 'Could not check setup.' });
    }
  }, [demo]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = (k: CheckKey): boolean | null => {
    if (!state.data) return null;
    if (k === 'webhookSeen') return state.data.webhookSeen ?? null;
    const v = state.data.env[k];
    return typeof v === 'boolean' ? v : null;
  };
  const missing = (Object.keys(CHECK_LABEL) as CheckKey[]).filter((k) => value(k) === false);
  return { ...state, refresh, value, missing };
}

export const SetupStatusDialog = ({
  open,
  onOpenChange,
  status,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  status: ReturnType<typeof useWhatsAppSetupStatus>;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>WhatsApp setup</DialogTitle>
        <DialogDescription>
          The full click-by-click guide is in <span className="font-mono text-xs">docs/WHATSAPP_SETUP.md</span>. Step numbers below match it.
        </DialogDescription>
      </DialogHeader>

      <div aria-live="polite" className="text-sm">
        {status.loading ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking…
          </p>
        ) : status.error ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Could not check the server: {status.error}
          </p>
        ) : status.missing.length === 0 ? (
          <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Everything is connected.
          </p>
        ) : (
          <p className="text-amber-800 dark:text-amber-200">
            {status.missing.length} item{status.missing.length === 1 ? '' : 's'} still missing. Look for the red marks below.
          </p>
        )}
      </div>

      <ol className="space-y-3">
        {STEPS.map((s) => {
          const results = s.checks.map((k) => ({ k, v: status.value(k) }));
          const bad = results.some((r) => r.v === false);
          return (
            <li key={s.n} className={`rounded-xl border p-3 ${bad ? 'border-red-200 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/5' : 'border-border'}`}>
              <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                <span className="grid h-5 w-5 flex-none place-items-center rounded-full bg-muted text-[11px] tabular-nums">{s.n}</span>
                {s.title}
              </p>
              <p className="mt-1 pl-7 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
              {results.length > 0 && (
                <ul className="mt-2 space-y-1 pl-7">
                  {results.map(({ k, v }) => (
                    <li key={k} className="flex items-center gap-1.5 text-xs">
                      {v === true ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : v === false ? (
                        <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden />
                      ) : (
                        <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      )}
                      <span className={v === false ? 'text-red-800 dark:text-red-200' : 'text-foreground'}>{CHECK_LABEL[k]}</span>
                      <span className="sr-only">{v === true ? 'done' : v === false ? 'missing' : 'unknown'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={status.refresh}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.97]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden /> Check again
      </button>
    </DialogContent>
  </Dialog>
);

/** Small trigger for the list header; shows a dot when something is missing. */
export const SetupStatusButton = ({ missing, onClick }: { missing: number; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] transition-[background-color,transform] duration-150 hover:bg-black/5 active:scale-[0.97] dark:text-[#aebac1] dark:hover:bg-white/10"
    aria-label={missing ? `WhatsApp setup: ${missing} item${missing === 1 ? '' : 's'} missing` : 'WhatsApp setup'}
  >
    <Settings2 className="h-5 w-5" aria-hidden />
    {missing > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#f0f2f5] dark:ring-[#202c33]" aria-hidden />}
  </button>
);
