/**
 * `firebase/firestore`, with an activity log and a recycle bin.
 *
 * vite.config.ts aliases every `import ... from 'firebase/firestore'` in the
 * app to this file, so the 57 places that write or delete from admin pages are
 * covered without each one remembering to. Everything is re-exported
 * untouched except the five write entry points below.
 *
 * Only while an owner or team member works inside /admin (see ./actor.ts):
 *   - deleteDoc / batch.delete first copy the document into `recycleBin`, so
 *     the owner can restore it; emptying it there deletes for good.
 *   - setDoc / addDoc / updateDoc / deleteDoc / batches add an `activityLog`
 *     entry: who, what, which document, which fields (never the values).
 * Customers and the storefront are never affected. A failure to log never
 * fails the write itself; a failure to bin DOES stop the delete, because
 * deleting something the owner can't get back is exactly what this prevents.
 */
import * as fs from '@firebase/firestore';
import type {
  DocumentData,
  DocumentReference,
  CollectionReference,
  SetOptions,
  WriteBatch,
  Firestore,
  UpdateData,
  WithFieldValue,
  PartialWithFieldValue,
} from '@firebase/firestore';
import { currentAuditActor, type AuditActor } from './actor';
import { changedFields, isAudited, labelFor, sectionFor, splitPath } from './sections';

export * from '@firebase/firestore';

type Action = 'create' | 'update' | 'delete' | 'save';

/** Same person, same document, same action within this window: one entry. */
const DEDUPE_MS = 4000;
const recent = new Map<string, number>();

function logActivity(
  db: Firestore,
  actor: AuditActor,
  action: Action,
  path: string,
  data?: Record<string, unknown> | null,
  extra: Record<string, unknown> = {},
) {
  const key = `${actor.uid}|${action}|${path}|${extra.purged ? 'p' : ''}${extra.restored ? 'r' : ''}`;
  const now = Date.now();
  if ((recent.get(key) || 0) > now - DEDUPE_MS) return;
  recent.set(key, now);
  const { collection, docId } = splitPath(path);
  void fs
    .addDoc(fs.collection(db, 'activityLog'), {
      at: fs.serverTimestamp(),
      actorUid: actor.uid,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      path,
      collection,
      docId,
      section: sectionFor(path),
      label: labelFor(data as Record<string, unknown>, docId),
      fields: action === 'delete' ? [] : changedFields(data as Record<string, unknown>),
      page: typeof window !== 'undefined' ? window.location.pathname : '',
      ...extra,
    })
    .catch((err) => console.warn('[activity] not recorded:', err?.code || err));
}

/** Copy a document into the bin. Returns its label, or null when it didn't exist. */
async function binDocument(ref: DocumentReference, actor: AuditActor): Promise<{ label: string; binId: string } | null> {
  const snap = await fs.getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const { collection, docId } = splitPath(ref.path);
  const label = labelFor(data, docId);
  const binRef = fs.doc(fs.collection(ref.firestore, 'recycleBin'));
  await fs.setDoc(binRef, {
    path: ref.path,
    collection,
    docId,
    section: sectionFor(ref.path),
    label,
    data,
    deletedAt: fs.serverTimestamp(),
    deletedByUid: actor.uid,
    deletedByName: actor.name,
    deletedByRole: actor.role,
  });
  return { label, binId: binRef.id };
}

/**
 * Worth recording for this person? Their own users/{uid} document is skipped:
 * sign-in keeps login counters and session data there, which is bookkeeping,
 * not something they changed.
 */
function auditedFor(actor: AuditActor | null, path: string): actor is AuditActor {
  return !!actor && isAudited(path) && path !== `users/${actor.uid}`;
}

export async function deleteDoc(reference: DocumentReference<any, any>): Promise<void> {
  const actor = currentAuditActor();
  if (!auditedFor(actor, reference.path)) return fs.deleteDoc(reference);
  const binned = await binDocument(reference, actor);
  await fs.deleteDoc(reference);
  if (binned) logActivity(reference.firestore, actor, 'delete', reference.path, { name: binned.label }, { binId: binned.binId });
}

export function setDoc<A, B extends DocumentData>(reference: DocumentReference<A, B>, data: WithFieldValue<A>): Promise<void>;
export function setDoc<A, B extends DocumentData>(
  reference: DocumentReference<A, B>,
  data: PartialWithFieldValue<A>,
  options: SetOptions,
): Promise<void>;
export async function setDoc(reference: DocumentReference<any, any>, data: any, options?: SetOptions): Promise<void> {
  const actor = currentAuditActor();
  const audited = auditedFor(actor, reference.path);
  // A full write either creates or replaces: look first so the log can say which.
  let existed = true;
  if (audited) {
    try {
      existed = (await fs.getDoc(reference)).exists();
    } catch {
      existed = true;
    }
  }
  await (options ? fs.setDoc(reference, data, options) : fs.setDoc(reference, data));
  if (audited) logActivity(reference.firestore, actor, existed ? 'update' : 'create', reference.path, data);
}

export async function addDoc<A, B extends DocumentData>(
  reference: CollectionReference<A, B>,
  data: WithFieldValue<A>,
): Promise<DocumentReference<A, B>> {
  const ref = await fs.addDoc(reference, data);
  const actor = currentAuditActor();
  if (auditedFor(actor, ref.path)) logActivity(ref.firestore, actor, 'create', ref.path, data as Record<string, unknown>);
  return ref;
}

export function updateDoc<A, B extends DocumentData>(reference: DocumentReference<A, B>, data: UpdateData<B>): Promise<void>;
export function updateDoc<A, B extends DocumentData>(
  reference: DocumentReference<A, B>,
  field: string | fs.FieldPath,
  value: unknown,
  ...moreFieldsAndValues: unknown[]
): Promise<void>;
export async function updateDoc(reference: DocumentReference<any, any>, ...args: any[]): Promise<void> {
  await (fs.updateDoc as (...a: any[]) => Promise<void>)(reference, ...args);
  const actor = currentAuditActor();
  if (!auditedFor(actor, reference.path)) return;
  const data =
    args.length === 1 && args[0] && typeof args[0] === 'object'
      ? (args[0] as Record<string, unknown>)
      : Object.fromEntries(args.filter((_, i) => i % 2 === 0).map((f) => [String(f), true]));
  logActivity(reference.firestore, actor, 'update', reference.path, data);
}

/**
 * A batch that bins its deletes before committing and logs every write after.
 * Other methods behave exactly like the real WriteBatch.
 */
export function writeBatch(firestore: Firestore): WriteBatch {
  const real = fs.writeBatch(firestore);
  const ops: Array<{ action: Action; ref: DocumentReference; data?: any }> = [];
  const wrapped = {
    set(ref: DocumentReference<any, any>, data: any, options?: SetOptions) {
      options ? real.set(ref, data, options) : real.set(ref, data);
      ops.push({ action: 'save', ref, data });
      return wrapped;
    },
    update(ref: DocumentReference<any, any>, ...args: any[]) {
      (real.update as (...a: any[]) => WriteBatch)(ref, ...args);
      ops.push({ action: 'update', ref, data: args.length === 1 ? args[0] : undefined });
      return wrapped;
    },
    delete(ref: DocumentReference<any, any>) {
      real.delete(ref);
      ops.push({ action: 'delete', ref });
      return wrapped;
    },
    async commit() {
      const actor = currentAuditActor();
      const audited = actor ? ops.filter((o) => auditedFor(actor, o.ref.path)) : [];
      const binned = new Map<string, { label: string; binId: string }>();
      if (actor) {
        for (const o of audited) {
          if (o.action !== 'delete') continue;
          const b = await binDocument(o.ref, actor);
          if (b) binned.set(o.ref.path, b);
        }
      }
      await real.commit();
      if (!actor) return;
      for (const o of audited) {
        if (o.action === 'delete') {
          const b = binned.get(o.ref.path);
          if (b) logActivity(firestore, actor, 'delete', o.ref.path, { name: b.label }, { binId: b.binId });
        } else {
          logActivity(firestore, actor, o.action, o.ref.path, o.data);
        }
      }
    },
  };
  return wrapped as unknown as WriteBatch;
}

// ── Recycle bin actions (owner only; firestore.rules enforce it) ─────────────

export interface RecycleBinEntry {
  id: string;
  path: string;
  collection: string;
  docId: string;
  section: string;
  label: string;
  data: DocumentData;
  deletedAt?: fs.Timestamp;
  deletedByUid?: string;
  deletedByName?: string;
  deletedByRole?: string;
}

/** Put the document back where it was, then drop it from the bin. */
export async function restoreFromBin(db: Firestore, entry: RecycleBinEntry, actor: AuditActor): Promise<void> {
  const target = fs.doc(db, entry.path);
  const existing = await fs.getDoc(target);
  if (existing.exists()) {
    throw new Error(`Something already exists at that place ("${labelFor(existing.data(), entry.docId)}"). Remove it first, then restore.`);
  }
  await fs.setDoc(target, entry.data);
  await fs.deleteDoc(fs.doc(db, 'recycleBin', entry.id));
  logActivity(db, actor, 'create', entry.path, { name: entry.label }, { restored: true, binId: entry.id });
}

/** Delete from the bin for good. */
export async function purgeFromBin(db: Firestore, entry: RecycleBinEntry, actor: AuditActor): Promise<void> {
  await fs.deleteDoc(fs.doc(db, 'recycleBin', entry.id));
  logActivity(db, actor, 'delete', entry.path, { name: entry.label }, { purged: true, binId: entry.id });
}
