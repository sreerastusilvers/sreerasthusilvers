import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query, type Timestamp } from 'firebase/firestore';
import { History, Loader2, Pencil, Plus, Search, Trash2, RotateCcw, Ban } from 'lucide-react';
import { db } from '@/config/firebase';
import { Input } from '@/components/ui/input';
import { staffRoleLabel } from '@/lib/permissions';

interface ActivityEntry {
  id: string;
  at?: Timestamp;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: 'create' | 'update' | 'delete' | 'save';
  path: string;
  section: string;
  label: string;
  fields?: string[];
  restored?: boolean;
  purged?: boolean;
  binId?: string;
}

const PAGE = 300;

const verb = (e: ActivityEntry) => {
  if (e.restored) return { text: 'restored', icon: RotateCcw, tone: 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10' };
  if (e.purged) return { text: 'deleted forever', icon: Ban, tone: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10' };
  if (e.action === 'delete') return { text: 'removed', icon: Trash2, tone: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10' };
  if (e.action === 'create') return { text: 'added', icon: Plus, tone: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' };
  return { text: 'changed', icon: Pencil, tone: 'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10' };
};

const dayLabel = (d: Date) => {
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

/** Owner-only: every change made in the admin panel, newest first. */
export default function AdminActivity() {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState('');
  const [who, setWho] = useState('all');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'activityLog'), orderBy('at', 'desc'), limit(PAGE)),
        (snap) => setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityEntry, 'id'>) }))),
        (e) => {
          setError(e.message);
          setEntries([]);
        },
      ),
    [],
  );

  const people = useMemo(() => {
    const m = new Map<string, string>();
    (entries || []).forEach((e) => m.set(e.actorUid, `${e.actorName} (${e.actorRole === 'admin' ? 'Owner' : staffRoleLabel(e.actorRole)})`));
    return [...m.entries()];
  }, [entries]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (entries || []).filter((e) => {
      if (who !== 'all' && e.actorUid !== who) return false;
      if (kind === 'removed' && !(e.action === 'delete')) return false;
      if (kind === 'added' && e.action !== 'create') return false;
      if (kind === 'changed' && !(e.action === 'update' || e.action === 'save')) return false;
      if (q && !`${e.label} ${e.section} ${e.actorName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, who, kind, search]);

  const groups = useMemo(() => {
    const out: Array<{ day: string; items: ActivityEntry[] }> = [];
    for (const e of shown) {
      const day = e.at ? dayLabel(e.at.toDate()) : 'Just now';
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(e);
      else out.push({ day, items: [e] });
    }
    return out;
  }, [shown]);

  const selectClass =
    'h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Activity</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Every add, change and removal made in the admin panel, by you or your team. Removed items can be brought back from the{' '}
          <Link to="/admin/recycle-bin" className="text-amber-700 dark:text-amber-400 underline underline-offset-2">Recycle bin</Link>.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by item or person" className="pl-9" aria-label="Search activity" />
        </div>
        <select value={who} onChange={(e) => setWho(e.target.value)} className={selectClass} aria-label="Who">
          <option value="all">Everyone</option>
          {people.map(([uid, name]) => (
            <option key={uid} value={uid}>{name}</option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={selectClass} aria-label="What">
          <option value="all">All actions</option>
          <option value="added">Added</option>
          <option value="changed">Changed</option>
          <option value="removed">Removed</option>
        </select>
      </div>

      {entries === null ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-amber-600" /></div>
      ) : error ? (
        <p className="rounded-xl bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">Could not load activity: {error}</p>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-10 text-center">
          <History className="mx-auto h-10 w-10 text-gray-400" />
          <p className="mt-3 font-medium text-gray-900 dark:text-white">{entries.length ? 'Nothing matches' : 'No activity yet'}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Changes made from now on show up here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{g.day}</h2>
              <ol className="divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden rounded-2xl border border-[#F5EFE6] dark:border-gray-800 bg-white dark:bg-gray-900">
                {g.items.map((e) => {
                  const v = verb(e);
                  return (
                    <li key={e.id} className="flex items-start gap-3 p-3.5 md:p-4">
                      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${v.tone}`}>
                        <v.icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="text-gray-900 dark:text-gray-100">
                          <span className="font-semibold">{e.actorName}</span>{' '}
                          <span className="text-gray-500 dark:text-gray-400">({e.actorRole === 'admin' ? 'Owner' : staffRoleLabel(e.actorRole)})</span>{' '}
                          {v.text} <span className="font-medium">“{e.label}”</span>{' '}
                          <span className="text-gray-500 dark:text-gray-400">in {e.section}</span>
                        </p>
                        {e.fields && e.fields.length > 0 && e.action !== 'delete' && (
                          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">Fields: {e.fields.join(', ')}</p>
                        )}
                        {e.action === 'delete' && !e.purged && e.binId && (
                          <Link to="/admin/recycle-bin" className="mt-0.5 inline-block text-xs text-amber-700 dark:text-amber-400 underline underline-offset-2">
                            In the recycle bin
                          </Link>
                        )}
                      </div>
                      <time className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                        {e.at ? e.at.toDate().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : 'now'}
                      </time>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {entries.length >= PAGE && <p className="text-center text-xs text-gray-500">Showing the latest {PAGE} entries.</p>}
        </div>
      )}
    </div>
  );
}
