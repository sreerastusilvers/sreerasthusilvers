import { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { purgeFromBin, restoreFromBin, type RecycleBinEntry } from '@/lib/audit/firestore';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Search, Trash, Trash2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { staffRoleLabel } from '@/lib/permissions';
import { releaseProductImages } from '@/services/productService';
import { invalidateProductCache } from '@/services/productCache';
import { requestCatalogRefresh } from '@/services/catalogPublisher';

/**
 * Owner-only. Anything removed in the admin panel lands here first (see
 * src/lib/audit/firestore.ts). Restore puts it back exactly as it was;
 * "Delete forever" removes it for good, and for products frees their photos.
 */
export default function AdminRecycleBin() {
  const { userProfile } = useAuth();
  const [entries, setEntries] = useState<RecycleBinEntry[] | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'one'; entry: RecycleBinEntry } | { kind: 'all' } | null>(null);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'recycleBin'), orderBy('deletedAt', 'desc'), limit(500)),
        (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RecycleBinEntry, 'id'>) }))),
        (e) => {
          toast.error('Could not open the recycle bin', { description: describeError(e) });
          setEntries([]);
        },
      ),
    [],
  );

  const actor = userProfile ? { uid: userProfile.uid, name: userProfile.username || 'Owner', role: 'admin' } : null;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (entries || []).filter((e) => !q || `${e.label} ${e.section} ${e.deletedByName}`.toLowerCase().includes(q));
  }, [entries, search]);

  const restore = async (e: RecycleBinEntry) => {
    if (!actor) return;
    setBusy(e.id);
    try {
      await restoreFromBin(db, e, actor);
      if (e.collection === 'products' && e.path.startsWith('products/')) {
        invalidateProductCache();
        requestCatalogRefresh([e.docId]);
      }
      toast.success(`“${e.label}” is back`, { description: e.section });
    } catch (err) {
      toast.error('Could not restore', { description: describeError(err) });
    } finally {
      setBusy(null);
    }
  };

  const purge = async (e: RecycleBinEntry) => {
    if (!actor) return;
    await purgeFromBin(db, e, actor);
    if (e.path.startsWith('products/')) {
      const images = (e.data?.media?.images as string[] | undefined) || [];
      void releaseProductImages(images);
    }
  };

  const purgeConfirmed = async () => {
    if (!confirm) return;
    const list = confirm.kind === 'one' ? [confirm.entry] : shown;
    setBusy(confirm.kind === 'one' ? confirm.entry.id : 'all');
    let failed = 0;
    for (const e of list) {
      try {
        await purge(e);
      } catch {
        failed += 1;
      }
    }
    setBusy(null);
    if (failed) toast.error(`${failed} item${failed === 1 ? '' : 's'} could not be deleted`);
    else toast.success(list.length === 1 ? `“${list[0].label}” deleted forever` : `${list.length} items deleted forever`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Recycle Bin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
            Everything removed in the admin panel, by you or your team. Restore puts it back exactly as it was. Deleting it here removes it for good.
          </p>
        </div>
        {shown.length > 0 && (
          <Button variant="outline" className="gap-2 text-red-600 hover:text-red-700" onClick={() => setConfirm({ kind: 'all' })} disabled={busy !== null}>
            <Trash2 className="h-4 w-4" /> Empty {search ? 'these' : 'bin'}
          </Button>
        )}
      </div>

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search removed items" className="pl-9" aria-label="Search removed items" />
      </div>

      {entries === null ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center">
          <Trash className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 font-medium text-gray-900 dark:text-white">{entries.length ? 'Nothing matches' : 'The recycle bin is empty'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden rounded-2xl border border-[#F5EFE6] dark:border-gray-800 bg-white dark:bg-gray-900">
          {shown.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900 dark:text-white">{e.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {e.section} · removed by {e.deletedByName || 'someone'}
                  {e.deletedByRole ? ` (${e.deletedByRole === 'admin' ? 'Owner' : staffRoleLabel(e.deletedByRole)})` : ''}
                  {e.deletedAt ? ` · ${e.deletedAt.toDate().toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => restore(e)} disabled={busy !== null}>
                  {busy === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                  onClick={() => setConfirm({ kind: 'one', entry: e })}
                  disabled={busy !== null}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete forever
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'one' ? `Delete “${confirm.entry.label}” forever?` : `Delete ${shown.length} item${shown.length === 1 ? '' : 's'} forever?`}
            </AlertDialogTitle>
            <AlertDialogDescription>This can't be undone. Product photos are deleted from storage too.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void purgeConfirmed()}>
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
