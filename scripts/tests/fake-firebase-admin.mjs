// Minimal in-memory stand-in for firebase-admin used by api/broadcast.ts.
export const store = new Map(); // path -> data
const listeners = { updates: [] };

const serverTimestamp = () => ({ __ts: true });
const increment = (n) => ({ __inc: n });

function docRef(path) {
  return {
    id: path.split('/').pop(),
    path,
    collection: (name) => colRef(`${path}/${name}`),
    async get() {
      return snap(path);
    },
    async set(data, opts) {
      const prev = store.get(path);
      store.set(path, applyIncrements(opts?.merge && prev ? prev : {}, data, opts?.merge && prev));
    },
    async update(data) {
      if (!store.has(path)) {
        const e = new Error('NOT_FOUND');
        e.code = 5;
        throw e;
      }
      listeners.updates.push(path);
      store.set(path, { ...store.get(path), ...data });
    },
  };
}
/** Merge `data` over `prev`, turning increment() markers into numbers. */
function applyIncrements(prev, data, merge) {
  const out = merge ? { ...prev } : {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v === 'object' && '__inc' in v ? (Number(prev?.[k]) || 0) + v.__inc : v;
  }
  return out;
}
function snap(path) {
  const data = store.get(path);
  return { id: path.split('/').pop(), exists: data !== undefined, data: () => data };
}
function directChildren(colPath) {
  const depth = colPath.split('/').length + 1;
  return [...store.keys()].filter((k) => k.startsWith(colPath + '/') && k.split('/').length === depth);
}
function colRef(path, filters = [], lim = Infinity) {
  return {
    doc: (id) => docRef(`${path}/${id ?? Math.random().toString(36).slice(2, 10)}`),
    where: (f, op, v) => colRef(path, [...filters, [f, op, v]], lim),
    limit: (n) => colRef(path, filters, n),
    async get() {
      const docs = directChildren(path)
        .map(snap)
        .filter((s) => filters.every(([f, , v]) => s.data()?.[f] === v))
        .slice(0, lim);
      return { docs, forEach: (fn) => docs.forEach(fn), size: docs.length };
    },
  };
}
const db = {
  collection: (name) => colRef(name),
  async getAll(...refs) {
    return refs.map((r) => snap(r.path));
  },
  batch() {
    const ops = [];
    return { set: (ref, d, o) => ops.push(() => ref.set(d, o)), async commit() { for (const op of ops) await op(); } };
  },
  async runTransaction(fn) {
    return fn({ get: (ref) => ref.get(), set: (ref, d, o) => ref.set(d, o), update: (ref, d) => ref.update(d) });
  },
};

const firestore = Object.assign(() => db, { FieldValue: { serverTimestamp, increment } });
const adminStub = {
  apps: [1],
  firestore,
  // 'admin-token' → admin1; 'uid:<x>' → <x>; 'expired' throws; anything else → user1.
  auth: () => ({
    verifyIdToken: async (t) => {
      if (t === 'expired') throw new Error('auth/id-token-expired');
      return { uid: t === 'admin-token' ? 'admin1' : t.startsWith('uid:') ? t.slice(4) : 'user1' };
    },
    createCustomToken: async (uid, claims) => `custom:${uid}:${JSON.stringify(claims || {})}`,
  }),
  messaging: () => ({ sendEachForMulticast: async ({ tokens }) => ({ successCount: tokens.length, failureCount: 0, responses: tokens.map(() => ({ success: true })) }) }),
  credential: { cert: () => ({}) },
  initializeApp() {},
};
export default adminStub;
export { listeners };
