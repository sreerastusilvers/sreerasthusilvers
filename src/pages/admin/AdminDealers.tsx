import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { toast } from 'sonner';
import { CheckCircle2, Clock, EyeOff, Factory, Loader2, MessageSquareText, Pencil, Plus, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { describeError } from '@/lib/errorMessage';
import { WhatsAppApiError, whatsappAdminApi } from '@/services/whatsappAdminApi';
import {
  DEALER_TEMPLATE,
  getDealerChatSettings,
  normalizeDealerPhone,
  removeDealer,
  saveDealer,
  saveDealerChatSettings,
  subscribeDealerPrivate,
  subscribeDealers,
  type Dealer,
  type DealerChatSettings,
  type DealerPrivate,
} from '@/services/dealerService';

interface Draft {
  id?: string;
  displayName: string;
  originalName: string;
  phone: string;
  note: string;
  active: boolean;
}
const blank = (): Draft => ({ displayName: '', originalName: '', phone: '', note: '', active: true });

interface TemplateRow {
  id: string;
  name: string;
  language: string;
  status?: string | null;
  rejectedReason?: string | null;
}

/**
 * Owner only. The manufacturers list with real names and numbers, which staff
 * never see: staff chat under the display name in Dealer Chats.
 */
export default function AdminDealers() {
  const [dealers, setDealers] = useState<Dealer[] | null>(null);
  const [priv, setPriv] = useState<Record<string, DealerPrivate>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<Dealer | null>(null);

  useEffect(() => {
    const onErr = (e: Error) => toast.error('Could not load manufacturers', { description: describeError(e) });
    const u1 = subscribeDealers(setDealers, (e) => {
      onErr(e);
      setDealers([]);
    });
    const u2 = subscribeDealerPrivate(setPriv, onErr);
    return () => {
      u1();
      u2();
    };
  }, []);

  const errors = useMemo(() => {
    if (!draft) return {};
    const e: Record<string, string> = {};
    if (!draft.displayName.trim()) e.displayName = 'Staff see this name. For example "Dealer A" or "Anklet maker".';
    if (!draft.originalName.trim()) e.originalName = 'Enter their real name (only you see it).';
    if (!normalizeDealerPhone(draft.phone)) e.phone = 'Enter their WhatsApp number, for example 98765 43210.';
    const phone = normalizeDealerPhone(draft.phone);
    const dup = Object.entries(priv).find(([id, p]) => p.phone === phone && id !== draft.id);
    if (phone && dup) e.phone = 'This number is already saved for another manufacturer.';
    return e;
  }, [draft, priv]);

  const save = async () => {
    if (!draft || Object.keys(errors).length) return;
    setSaving(true);
    try {
      await saveDealer(draft);
      toast.success(draft.id ? 'Saved' : `${draft.displayName.trim()} added`, {
        description: draft.id ? undefined : 'Staff can now raise tickets to them in Dealer Chats.',
      });
      setDraft(null);
    } catch (e) {
      toast.error('Could not save', { description: describeError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Manufacturers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Staff talk to manufacturers in{' '}
            <Link to="/admin/dealer-chats" className="text-amber-700 dark:text-amber-400 underline underline-offset-2">Dealer Chats</Link>{' '}
            using only the display name. Real names and numbers stay on this page, which only you can open.
          </p>
        </div>
        <Button className="gap-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setDraft(blank())}>
          <Plus className="h-4 w-4" /> Add manufacturer
        </Button>
      </div>

      <TemplateSetupCard />

      {dealers === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
      ) : dealers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center">
          <Factory className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 font-medium text-gray-900 dark:text-white">No manufacturers yet</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add one with a display name your staff will see.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-[#F5EFE6] dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          {dealers.map((d) => {
            const p = priv[d.id];
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#dfe5e7] dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                  <Factory className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {d.displayName}
                    {!d.active && <span className="ml-2 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-normal text-gray-600 dark:text-gray-400">Hidden from staff</span>}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="inline-flex items-center gap-1">
                      <EyeOff className="h-3.5 w-3.5 text-gray-400" aria-label="Only you see this" />
                      {p?.originalName || '—'}
                    </span>
                    <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
                    <span className="tabular-nums">{p?.phone || 'No number'}</span>
                    {p?.waProfileName && p.waProfileName !== p.originalName && (
                      <span className="ml-2 text-xs text-gray-500">WhatsApp name: {p.waProfileName}</span>
                    )}
                  </p>
                  {d.note && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{d.note}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <Link to={`/admin/dealer-chats?dealer=${d.id}`}>
                      <MessageSquareText className="h-3.5 w-3.5" /> Chat
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setDraft({ id: d.id, displayName: d.displayName, originalName: p?.originalName || '', phone: p?.phone || '', note: d.note || '', active: d.active !== false })}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10" onClick={() => setRemoving(d)} aria-label={`Remove ${d.displayName}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && !saving && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit manufacturer' : 'Add manufacturer'}</DialogTitle>
            <DialogDescription>Staff only ever see the display name.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div>
                <Label htmlFor="d-display">Display name (staff see this)</Label>
                <Input id="d-display" value={draft.displayName} maxLength={40} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} placeholder="Dealer A" />
                {errors.displayName && <p className="mt-1 text-xs text-red-600">{errors.displayName}</p>}
              </div>
              <div>
                <Label htmlFor="d-real">Real name (only you)</Label>
                <Input id="d-real" value={draft.originalName} maxLength={80} onChange={(e) => setDraft({ ...draft, originalName: e.target.value })} />
                {errors.originalName && <p className="mt-1 text-xs text-red-600">{errors.originalName}</p>}
              </div>
              <div>
                <Label htmlFor="d-phone">WhatsApp number (only you)</Label>
                <Input id="d-phone" type="tel" inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="98765 43210" />
                {errors.phone ? (
                  <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
                ) : draft.phone ? (
                  <p className="mt-1 text-xs text-gray-500">Saved as {normalizeDealerPhone(draft.phone)}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="d-note">What they make (optional, staff see this)</Label>
                <Textarea id="d-note" rows={2} maxLength={200} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Anklets, toe rings, kids' bangles" />
              </div>
              <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <span className="text-sm">
                  <span className="block font-medium text-gray-900 dark:text-white">Show to staff</span>
                  <span className="block text-xs text-gray-500">Turn off to pause tickets to this manufacturer.</span>
                </span>
                <Switch checked={draft.active} onCheckedChange={(v) => setDraft({ ...draft, active: v })} />
              </label>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving || Object.keys(errors).length > 0} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              It goes to the Recycle bin, so you can restore it. Their past messages and tickets are kept. New messages from their number will land in the customer inbox until you restore it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!removing) return;
                try {
                  await removeDealer(removing.id);
                  toast.success(`${removing.displayName} moved to the recycle bin`);
                } catch (e) {
                  toast.error('Could not remove', { description: describeError(e) });
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * One-time setup: the approved template that starts a conversation with a
 * manufacturer. WhatsApp only lets a business message someone first through a
 * template; once they reply, staff can chat freely for 24 hours.
 */
function TemplateSetupCard() {
  const [settings, setSettings] = useState<DealerChatSettings | null | undefined>(undefined);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [busy, setBusy] = useState<'create' | 'sync' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDealerChatSettings().then(setSettings).catch(() => setSettings(null));
    return onSnapshot(
      query(collection(db, 'whatsappTemplates'), where('name', '>=', DEALER_TEMPLATE.baseName), where('name', '<=', `${DEALER_TEMPLATE.baseName}`)),
      (snap) => setTemplates(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TemplateRow, 'id'>) }))),
      () => setTemplates([]),
    );
  }, []);

  const current = settings ? templates.find((t) => t.name === settings.templateName) || null : null;
  const status = String(current?.status || (settings ? 'PENDING' : '')).toUpperCase();

  const create = async () => {
    setBusy('create');
    setError(null);
    try {
      const taken = new Set(templates.map((t) => t.name));
      let name = DEALER_TEMPLATE.baseName;
      for (let v = 2; taken.has(name); v += 1) name = `${DEALER_TEMPLATE.baseName}_v${v}`;
      await whatsappAdminApi.createTemplate({
        name,
        language: DEALER_TEMPLATE.language,
        category: DEALER_TEMPLATE.category,
        body: { text: DEALER_TEMPLATE.body, examples: DEALER_TEMPLATE.examples },
        paramLabels: DEALER_TEMPLATE.paramLabels,
      });
      const next = { templateName: name, language: DEALER_TEMPLATE.language };
      await saveDealerChatSettings(next);
      setSettings(next);
      toast.success('Template sent to Meta for review');
    } catch (err) {
      setError(err instanceof WhatsAppApiError ? err.message : describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy('sync');
    setError(null);
    try {
      await whatsappAdminApi.listTemplates(true);
    } catch (err) {
      setError(err instanceof WhatsAppApiError ? err.message : 'Could not check with Meta.');
    } finally {
      setBusy(null);
    }
  };

  if (settings === undefined) return null;

  let tone = 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100';
  let Icon = MessageSquareText;
  let title = 'One-time setup: the message that starts a dealer chat';
  let text =
    'WhatsApp lets a business message someone first only with a template Meta has approved. When staff raise a ticket, the manufacturer gets it and is asked to reply; once they do, staff can chat with them freely.';
  let action: 'create' | 'sync' | null = 'create';
  if (settings && (status === 'APPROVED' || (current && !current.status))) {
    tone = 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100';
    Icon = CheckCircle2;
    title = 'Dealer chats are ready';
    text = `New tickets start with the approved template “${settings.templateName}”.`;
    action = null;
  } else if (settings && (status === 'PENDING' || status === 'IN_APPEAL')) {
    Icon = Clock;
    title = 'Waiting for Meta to approve the template';
    text = `“${settings.templateName}” was sent for review. This usually takes minutes, sometimes up to 24 hours. Until then staff can only message a manufacturer who wrote in the last 24 hours.`;
    action = 'sync';
  } else if (settings && status === 'REJECTED') {
    tone = 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100';
    Icon = XCircle;
    title = 'Meta rejected the template';
    text = `${current?.rejectedReason ? `Reason: ${current.rejectedReason}. ` : ''}Submit it again; it goes in under a new name.`;
  }

  return (
    <section className={`rounded-2xl border p-4 ${tone}`} aria-live="polite">
      <div className="flex gap-3">
        <Icon className="h-5 w-5 flex-none" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm opacity-90">{text}</p>
          {action !== null && (
            <p className="mt-2 rounded-lg bg-white/70 p-2.5 text-sm text-gray-800 dark:bg-black/20 dark:text-gray-100">
              {DEALER_TEMPLATE.body.replace('{{1}}', 'T-0012').replace('{{2}}', 'Silver anklets, 2 pairs, about 40 g each')}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
          {action && (
            <Button size="sm" className="mt-3 gap-2" onClick={action === 'create' ? create : sync} disabled={busy !== null}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {action === 'create' ? (settings ? 'Submit again' : 'Create the template') : 'Check status with Meta'}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
