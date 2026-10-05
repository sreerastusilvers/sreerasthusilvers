/**
 * Marketing → Announcement: type a message, pick everyone or chosen
 * customers, send on WhatsApp (one approved template) and/or web push.
 * Delivery runs server-side in /api/broadcast.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  Megaphone,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
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
import WhatsAppPreviewBubble from '@/components/admin/whatsapp/WhatsAppPreviewBubble';
import { whatsappAdminApi, WhatsAppApiError } from '@/services/whatsappAdminApi';
import {
  ANNOUNCEMENT_FOOTER,
  ANNOUNCEMENT_MAX_LENGTH,
  NAME_FALLBACK,
  announcementTemplateDraft,
  countWhatsAppReach,
  isCustomerRole,
  nextAnnouncementName,
  pickAnnouncementTemplate,
  renderAnnouncement,
  toCustomerRow,
  toWhatsAppParam,
  type AnnouncementTemplateRow,
  type CustomerRow,
} from './announcement';

type Audience = 'customers' | 'selected';

interface SendResult {
  ok: boolean;
  error?: string;
  recipientCount?: number;
  push?: { successCount?: number; failureCount?: number } | null;
  whatsapp?: {
    successCount?: number;
    failureCount?: number;
    failures?: Array<{ error: string }>;
    skipped?: { noPhone: number; invalidPhone: number; optedOut: number; duplicate: number };
  } | null;
}

const card = 'bg-white border border-gray-100 rounded-2xl dark:bg-gray-900 dark:border-gray-800 p-5 shadow-sm';
const stepTitle = 'text-sm font-semibold text-gray-900 dark:text-gray-100';
const firstName = (name: string) => name.split(' ')[0] || '';

export default function AnnouncementComposer({ templates }: { templates: AnnouncementTemplateRow[] }) {
  const { user, userProfile } = useAuth();
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('customers');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [useWhatsApp, setUseWhatsApp] = useState(true);
  const [usePush, setUsePush] = useState(false);

  const [customers, setCustomers] = useState<CustomerRow[] | null>(null);
  const [optedOut, setOptedOut] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const template = useMemo(() => pickAnnouncementTemplate(templates), [templates]);
  const templateStatus = String(template?.status || '').toUpperCase();
  // Hand-entered templates have no status; treat them as usable like the rest of the page.
  const templateReady = !!template && (templateStatus === 'APPROVED' || !template.status);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [usersSnap, optSnap] = await Promise.all([
          getDocs(collection(db, 'users')),
          getDocs(query(collection(db, 'whatsappThreads'), where('marketingOptOut', '==', true))).catch(() => null),
        ]);
        if (cancelled) return;
        const rows = usersSnap.docs
          .filter((d) => isCustomerRole(d.data().role))
          .map((d) => toCustomerRow(d.id, d.data()))
          .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
        setCustomers(rows);
        setOptedOut(new Set(optSnap ? optSnap.docs.map((d) => d.id.replace(/\D/g, '')) : []));
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load customers.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const audienceRows = useMemo(() => {
    if (!customers) return [];
    return audience === 'customers' ? customers : customers.filter((c) => selected.has(c.uid));
  }, [customers, audience, selected]);

  const reach = useMemo(() => countWhatsAppReach(audienceRows, optedOut), [audienceRows, optedOut]);
  const previewName = firstName(audienceRows.find((r) => r.name)?.name || '') || NAME_FALLBACK;
  const trimmed = message.trim();

  const problems: string[] = [];
  if (!trimmed) problems.push('Write the announcement.');
  if (!useWhatsApp && !usePush) problems.push('Pick WhatsApp, website notification, or both.');
  if (audience === 'selected' && selected.size === 0) problems.push('Choose at least one customer.');
  if (useWhatsApp && !templateReady) problems.push('The WhatsApp announcement template is not approved yet (see the box above).');

  const send = async () => {
    setConfirmOpen(false);
    setSending(true);
    setResult(null);
    try {
      const idToken = await user?.getIdToken();
      if (!idToken) throw new Error('Please sign in again before sending.');
      const resp = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          audience,
          selectedUids: audience === 'selected' ? Array.from(selected) : undefined,
          channels: { push: usePush, whatsapp: useWhatsApp },
          push: usePush ? { title: 'Sreerasthu Silvers', body: trimmed.slice(0, 240), url: '/' } : undefined,
          whatsapp:
            useWhatsApp && template
              ? {
                  template: template.name,
                  language: template.language,
                  params: [NAME_FALLBACK, toWhatsAppParam(trimmed)],
                  personalizeFirst: true,
                }
              : undefined,
          kind: 'announcement',
          actorUid: user?.uid || null,
          actorEmail: userProfile?.email || user?.email || null,
        }),
      });
      const isJson = (resp.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await resp.json() : {};
      if (!isJson) throw new Error('Sending works on the live site only (the API runs on Vercel).');
      if (!resp.ok || !data.ok) throw new Error(data?.error || `Send failed (HTTP ${resp.status}).`);
      setResult({ ok: true, ...data });
      toast.success('Announcement sent.');
      setMessage('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed.';
      setResult({ ok: false, error: msg });
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const audienceLabel =
    audience === 'customers' ? `all ${customers?.length ?? ''} customers` : `${selected.size} chosen customer${selected.size === 1 ? '' : 's'}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-6 min-w-0">
        {useWhatsApp && <TemplateStatusCard template={template} templates={templates} />}

        <section className={`${card} space-y-3`}>
          <h2 className={stepTitle}>
            <label htmlFor="announcement-text">1. Write your announcement</label>
          </h2>
          <div className="relative">
            <textarea
              id="announcement-text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={ANNOUNCEMENT_MAX_LENGTH}
              rows={5}
              placeholder="For example: Our new silver anklet collection is in the store. Visit us this weekend to see it."
              aria-describedby="announcement-help"
              className="mc-input resize-y min-h-[120px] pb-6"
            />
            <span className="mc-counter" aria-hidden="true">
              {message.length}/{ANNOUNCEMENT_MAX_LENGTH}
            </span>
          </div>
          <p id="announcement-help" className="text-xs text-gray-500 dark:text-gray-400">
            Each customer sees their own first name in the greeting. WhatsApp shows the message as one paragraph, so
            line breaks become spaces. You can use *bold* and _italic_.
          </p>
        </section>

        <section className={`${card} space-y-4`}>
          <h2 className={stepTitle}>2. Choose who gets it</h2>
          <div role="radiogroup" aria-label="Audience" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <AudienceOption
              checked={audience === 'customers'}
              onSelect={() => setAudience('customers')}
              title="All customers"
              help={customers ? `${customers.length} customer accounts` : 'Loading…'}
            />
            <AudienceOption
              checked={audience === 'selected'}
              onSelect={() => setAudience('selected')}
              title="Choose customers"
              help={selected.size ? `${selected.size} chosen` : 'Pick names from the list'}
            />
          </div>
          {loadError && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              Could not load customers: {loadError}
            </p>
          )}
          {audience === 'selected' && (
            <CustomerPicker customers={customers} optedOut={optedOut} selected={selected} onChange={setSelected} />
          )}
        </section>

        <section className={`${card} space-y-3`}>
          <h2 className={stepTitle}>3. Send on</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ChannelCheck
              checked={useWhatsApp}
              onChange={setUseWhatsApp}
              icon={<MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
              title="WhatsApp"
              help="Meta charges a small fee for each marketing message."
            />
            <ChannelCheck
              checked={usePush}
              onChange={setUsePush}
              icon={<Bell className="h-4 w-4 text-amber-600" aria-hidden="true" />}
              title="Website notification"
              help="Only reaches people who allowed notifications."
            />
          </div>

          {useWhatsApp && customers && (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              WhatsApp will reach <strong className="text-gray-900 dark:text-gray-100">{reach.reach}</strong> number
              {reach.reach === 1 ? '' : 's'}.
              {reach.noNumber > 0 && ` ${reach.noNumber} without a valid mobile number will be skipped.`}
              {reach.optedOut > 0 && ` ${reach.optedOut} replied STOP and will be skipped.`}
              {reach.duplicate > 0 && ` ${reach.duplicate} share a number with another account and get one message.`}
            </p>
          )}

          {problems.length > 0 && (trimmed || audience === 'selected') && (
            <ul className="text-xs text-amber-800 dark:text-amber-300 list-disc pl-4 space-y-0.5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={sending || problems.length > 0}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:focus-visible:ring-offset-gray-900"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {sending ? 'Sending…' : 'Send announcement'}
          </button>

          {result && <ResultBox result={result} />}
        </section>
      </div>

      <aside className="lg:col-span-2 space-y-3 min-w-0 lg:sticky lg:top-4 self-start">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          WhatsApp preview
        </h2>
        <WhatsAppPreviewBubble
          body={trimmed ? renderAnnouncement(previewName, trimmed) : ''}
          footer={ANNOUNCEMENT_FOOTER}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Shown with the name of the first customer in your list. Customers who reply STOP stop getting announcements;
          START turns them back on.
        </p>
      </aside>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this announcement?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  It goes to {audienceLabel}
                  {useWhatsApp && ` (${reach.reach} on WhatsApp)`}
                  {usePush && useWhatsApp ? ' and as a website notification' : usePush ? ' as a website notification' : ''}.
                  You can’t take it back once it’s sent.
                </p>
                <p className="rounded-lg bg-gray-50 p-3 text-gray-700 dark:bg-gray-800 dark:text-gray-200 break-words">
                  {toWhatsAppParam(trimmed)}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={send} className="bg-amber-600 hover:bg-amber-700">
              Send now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TemplateStatusCard({
  template,
  templates,
}: {
  template: AnnouncementTemplateRow | null;
  templates: AnnouncementTemplateRow[];
}) {
  const [busy, setBusy] = useState<'create' | 'sync' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = String(template?.status || '').toUpperCase();

  const create = async () => {
    setBusy('create');
    setError(null);
    try {
      const name = nextAnnouncementName(templates);
      await whatsappAdminApi.createTemplate(announcementTemplateDraft(name));
      toast.success('Template sent to Meta for review.');
    } catch (err) {
      setError(err instanceof WhatsAppApiError ? err.message : 'Could not create the template.');
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

  let tone = 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100';
  let icon = <Megaphone className="h-5 w-5 flex-none" aria-hidden="true" />;
  let title = 'One-time setup: create the WhatsApp announcement template';
  let text = 'WhatsApp only allows messages to customers through a template that Meta has approved. Click the button once. Meta usually approves it within minutes, sometimes up to 24 hours.';
  let action: 'create' | 'sync' | null = 'create';

  if (template && (status === 'APPROVED' || !template.status)) {
    tone = 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100';
    icon = <CheckCircle2 className="h-5 w-5 flex-none" aria-hidden="true" />;
    title = 'WhatsApp is ready';
    text = `Announcements use the approved template “${template.name}”.`;
    action = null;
  } else if (template && (status === 'PENDING' || status === 'IN_APPEAL')) {
    icon = <Clock className="h-5 w-5 flex-none" aria-hidden="true" />;
    title = 'Waiting for Meta to approve the template';
    text = 'This usually takes a few minutes and can take up to 24 hours. Check again later.';
    action = 'sync';
  } else if (template && status === 'REJECTED') {
    tone = 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100';
    icon = <XCircle className="h-5 w-5 flex-none" aria-hidden="true" />;
    title = 'Meta rejected the template';
    text = `${template.rejectedReason ? `Reason: ${template.rejectedReason}. ` : ''}Submit it again under a new name. If it is rejected twice, ask your developer.`;
  } else if (template) {
    title = `Template status: ${status.replace(/_/g, ' ').toLowerCase()}`;
    text = 'Meta has paused or disabled it. Check WhatsApp Manager, or submit a new version.';
  }

  return (
    <section className={`rounded-2xl border p-4 ${tone}`} aria-live="polite">
      <div className="flex gap-3">
        {icon}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs opacity-90">{text}</p>
          {error && (
            <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          {action && (
            <div className="flex flex-wrap gap-2">
              {action === 'create' && (
                <button type="button" onClick={create} disabled={!!busy} className="mc-btn">
                  {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Megaphone className="h-4 w-4" aria-hidden="true" />}
                  {template ? 'Submit a new version' : 'Create announcement template'}
                </button>
              )}
              <button type="button" onClick={sync} disabled={!!busy} className="mc-btn mc-btn-ghost">
                {busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                Check status with Meta
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AudienceOption({
  checked,
  onSelect,
  title,
  help,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  help: string;
}) {
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-amber-500 ${
        checked
          ? 'border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/10'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
      }`}
    >
      <input type="radio" name="announcement-audience" checked={checked} onChange={onSelect} className="mt-1 accent-amber-600" />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> {title}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{help}</span>
      </span>
    </label>
  );
}

function ChannelCheck({
  checked,
  onChange,
  icon,
  title,
  help,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: ReactNode;
  title: string;
  help: string;
}) {
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-amber-500 ${
        checked
          ? 'border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/10'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-amber-600" />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
          {icon} {title}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">{help}</span>
      </span>
    </label>
  );
}

function CustomerPicker({
  customers,
  optedOut,
  selected,
  onChange,
}: {
  customers: CustomerRow[] | null;
  optedOut: Set<string>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [term, setTerm] = useState('');
  const shown = useMemo(() => {
    if (!customers) return [];
    const t = term.trim().toLowerCase();
    if (!t) return customers;
    const digits = t.replace(/\D/g, '');
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(t) ||
        c.email.toLowerCase().includes(t) ||
        (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits)),
    );
  }, [customers, term]);

  const toggle = (uid: string) => {
    const next = new Set(selected);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    onChange(next);
  };
  const allShownSelected = shown.length > 0 && shown.every((c) => selected.has(c.uid));
  const toggleShown = () => {
    const next = new Set(selected);
    shown.forEach((c) => (allShownSelected ? next.delete(c.uid) : next.add(c.uid)));
    onChange(next);
  };

  if (!customers) {
    return (
      <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading customers…
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name, email or phone"
          aria-label="Search customers"
          className="mc-input" style={{ paddingLeft: "2rem" }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
        <span>
          {selected.size} chosen · {shown.length} shown
        </span>
        <span className="flex gap-1">
          <button type="button" onClick={toggleShown} disabled={shown.length === 0} className="mc-link">
            {allShownSelected ? 'Unselect shown' : 'Select all shown'}
          </button>
          {selected.size > 0 && (
            <button type="button" onClick={() => onChange(new Set())} className="mc-link">
              Clear
            </button>
          )}
        </span>
      </div>
      <ul className="max-h-80 overflow-auto rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {shown.length === 0 && (
          <li className="p-4 text-center text-xs text-gray-500 dark:text-gray-400">No customers match “{term}”.</li>
        )}
        {shown.map((c) => {
          const stopped = !!c.waNumber && optedOut.has(c.waNumber);
          return (
            <li key={c.uid}>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 hover:bg-amber-50/60 dark:hover:bg-amber-500/5">
                <input
                  type="checkbox"
                  checked={selected.has(c.uid)}
                  onChange={() => toggle(c.uid)}
                  className="accent-amber-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {c.name || c.email || 'Unnamed customer'}
                  </span>
                  <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                    {[c.phone, c.name ? c.email : ''].filter(Boolean).join(' · ') || 'No contact details'}
                  </span>
                </span>
                {!c.waNumber && (
                  <span className="flex-none rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    No WhatsApp no.
                  </span>
                )}
                {stopped && (
                  <span className="flex-none rounded-full bg-red-50 px-2 py-0.5 text-[11px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    Replied STOP
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResultBox({ result }: { result: SendResult }) {
  if (!result.ok) {
    return (
      <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <p className="font-medium">{result.error || 'Send failed.'}</p>
      </div>
    );
  }
  const wa = result.whatsapp;
  const skipped = wa?.skipped;
  const skippedTotal = skipped ? skipped.noPhone + skipped.invalidPhone + skipped.optedOut + skipped.duplicate : 0;
  const firstError = wa?.failures?.[0]?.error;
  return (
    <div role="status" className="flex gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-100">
      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">Sent.</p>
        {wa && (
          <p className="text-xs">
            WhatsApp: {wa.successCount ?? 0} accepted by Meta
            {wa.failureCount ? `, ${wa.failureCount} failed` : ''}
            {skippedTotal ? `, ${skippedTotal} skipped (no number, replied STOP or duplicate)` : ''}.
            {firstError && ` First error: ${firstError}`}
          </p>
        )}
        {result.push && (
          <p className="text-xs">
            Website notification: {result.push.successCount ?? 0} delivered
            {result.push.failureCount ? `, ${result.push.failureCount} failed` : ''}.
          </p>
        )}
        <p className="text-xs opacity-80">Each message is saved in Admin → WhatsApp under that customer, with delivery ticks, and shows there when they reply.</p>
      </div>
    </div>
  );
}
