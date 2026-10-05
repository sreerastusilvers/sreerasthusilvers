/**
 * Template library for Admin -> Marketing -> Templates: Firestore metadata
 * merged with the latest "Sync from Meta" result, status badges, delete.
 */
import { useMemo, useState } from 'react';
import { deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { AlertCircle, Loader2, RefreshCw, Trash2, FileText, ChevronDown } from 'lucide-react';
import { db } from '@/config/firebase';
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
import { whatsappAdminApi, WhatsAppApiError, type MetaTemplateRow } from '@/services/whatsappAdminApi';
import { statusStyle } from './templateRules';
import { formatWhatsAppText } from './WhatsAppPreviewBubble';

export interface LibraryTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  paramLabels: string[];
  description?: string | null;
  status?: string | null;
  rejectedReason?: string | null;
  source?: string | null;
  metaId?: string | null;
  bodyText?: string | null;
}

type Row = LibraryTemplate & { key: string; fromMeta: boolean };

export const StatusBadge = ({ status, className = '' }: { status?: string | null; className?: string }) => {
  const s = statusStyle(status);
  return (
    <span title={s.help} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.cls} ${className}`}>
      {s.label}
    </span>
  );
};

export const TemplateLibrary = ({ templates }: { templates: LibraryTemplate[] }) => {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [metaRows, setMetaRows] = useState<MetaTemplateRow[] | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'APPROVED' | 'PENDING' | 'REJECTED'>('all');

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    templates.forEach((t) => {
      map.set(`${t.name}|${t.language}`, { ...t, key: `fs-${t.id}`, fromMeta: t.source === 'meta' });
    });
    // The sync result is fresher than the Firestore snapshot until it lands.
    metaRows?.forEach((m) => {
      const k = `${m.name}|${m.language}`;
      const prev = map.get(k);
      map.set(k, {
        id: prev?.id || m.name,
        name: m.name,
        language: m.language,
        category: m.category.toLowerCase(),
        paramLabels: prev?.paramLabels || Array.from({ length: m.paramCount }, (_, i) => `Variable ${i + 1}`),
        description: prev?.description,
        status: m.status,
        rejectedReason: m.rejectedReason,
        source: 'meta',
        metaId: m.id,
        bodyText: m.bodyText,
        key: prev?.key || `meta-${m.id}`,
        fromMeta: true,
      });
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [templates, metaRows]);

  const counts = useMemo(() => {
    const c = { all: rows.length, APPROVED: 0, PENDING: 0, REJECTED: 0 };
    rows.forEach((r) => {
      const s = String(r.status || '').toUpperCase();
      if (s === 'APPROVED' || s === 'PENDING' || s === 'REJECTED') c[s] += 1;
    });
    return c;
  }, [rows]);
  const visible = filter === 'all' ? rows : rows.filter((r) => String(r.status || '').toUpperCase() === filter);

  const sync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const resp = await whatsappAdminApi.listTemplates(true);
      setMetaRows(resp.templates);
      setLastSync(new Date());
      toast.success(`Synced ${resp.templates.length} template${resp.templates.length === 1 ? '' : 's'} from Meta`);
    } catch (err) {
      setSyncError(err instanceof WhatsAppApiError ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const confirmDelete = async () => {
    const row = pendingDelete;
    if (!row) return;
    setDeleting(true);
    try {
      if (row.fromMeta) {
        await whatsappAdminApi.deleteTemplate(row.name, row.metaId);
        setMetaRows((prev) => prev?.filter((m) => !(m.name === row.name && (!row.metaId || m.id === row.metaId))) ?? prev);
        toast.success(`Deleted "${row.name}" from Meta`);
      } else {
        await deleteDoc(doc(db, 'whatsappTemplates', row.id));
        toast.success(`Removed "${row.name}" from the list`);
      }
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your templates</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {lastSync ? `Synced with Meta at ${lastSync.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.` : 'Sync to pull the latest approval status from Meta.'}
          </p>
        </div>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 transition-[background-color,transform] duration-150 hover:bg-gray-50 active:scale-[0.97] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
          {syncing ? 'Syncing…' : 'Sync from Meta'}
        </button>
      </div>

      <div aria-live="polite">
        {syncError && (
          <div role="alert" className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 sm:mx-5">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <span>{syncError}</span>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pt-4 sm:px-5" role="tablist" aria-label="Filter by status">
          {(['all', 'APPROVED', 'PENDING', 'REJECTED'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`inline-flex min-h-9 flex-none items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                filter === f
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : statusStyle(f).label}
              <span className="tabular-nums opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <FileText className="h-6 w-6 text-gray-400" aria-hidden />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No templates yet</p>
          <p className="max-w-sm text-xs text-gray-600 dark:text-gray-400">
            Create one with the "Create new" tab, or press Sync from Meta if you already made templates in WhatsApp Manager.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 p-2 dark:divide-gray-800 sm:p-3">
          {visible.map((t) => {
            const open = expanded === t.key;
            return (
              <li key={t.key} className="px-2 py-3 sm:px-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="break-all font-mono text-[13px] font-medium text-gray-900 dark:text-gray-100">{t.name}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {t.language} · {t.category}
                      {t.paramLabels.length ? ` · ${t.paramLabels.length} variable${t.paramLabels.length === 1 ? '' : 's'}` : ''}
                      {!t.fromMeta ? ' · added by hand' : ''}
                    </p>
                    {t.rejectedReason && (
                      <p className="mt-1.5 text-xs text-red-700 dark:text-red-300">
                        Reason from Meta: {t.rejectedReason.replace(/_/g, ' ').toLowerCase()}
                      </p>
                    )}
                    {(t.bodyText || t.description) && (
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : t.key)}
                        aria-expanded={open}
                        className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-amber-800 hover:underline dark:text-amber-300"
                      >
                        {open ? 'Hide text' : 'Show text'}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden />
                      </button>
                    )}
                    {open && (
                      <div className="mt-2 space-y-1 rounded-lg bg-gray-50 p-3 text-[13px] text-gray-800 dark:bg-gray-950 dark:text-gray-200">
                        {t.bodyText && <p className="whitespace-pre-wrap break-words">{formatWhatsAppText(t.bodyText)}</p>}
                        {t.description && <p className="text-xs text-gray-600 dark:text-gray-400">{t.description}</p>}
                        {t.paramLabels.length > 0 && (
                          <ol className="list-decimal pl-5 text-xs text-gray-600 dark:text-gray-400">
                            {t.paramLabels.map((p, i) => (
                              <li key={i}>{p}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(t)}
                    className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg text-gray-500 transition-[background-color,transform] duration-150 hover:bg-red-50 hover:text-red-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
          {visible.length === 0 && <li className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-400">No templates with this status.</li>}
        </ul>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.fromMeta
                ? `This deletes the ${pendingDelete?.metaId ? `${pendingDelete.language} version of the` : ''} template from Meta and removes it from the inbox and campaigns. Messages already sent are not affected. You cannot reuse this name for 30 days.`
                : 'This only removes it from the picker list here. Nothing changes in Meta.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default TemplateLibrary;
